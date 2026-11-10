// Send transactional mail and reserve its daily quota through the service role.
import 'server-only';
import { serverEnvironment } from '../config/server-env';
import {
  createTransactionalEmailSender,
  type TransactionalEmail,
} from '../notifications/email';
import { privilegedClient } from './server-client';

const notificationDatabase = privilegedClient;
const dailyQuota = serverEnvironment.server.BREVO_DAILY_EMAIL_QUOTA;

const sender = createTransactionalEmailSender({
  apiKey: serverEnvironment.server.BREVO_API_KEY,
  alertEmail: serverEnvironment.server.DEVELOPER_ALERT_EMAIL,
  dailyQuota,
  fromAddress: serverEnvironment.server.EMAIL_FROM_ADDRESS,
  fromName: serverEnvironment.server.EMAIL_FROM_NAME,
  reserveQuota: async () => {
    if (!dailyQuota) {
      throw new Error('Brevo daily quota is not configured.');
    }
    const { data, error } = await notificationDatabase.rpc(
      'record_email_send',
      { p_daily_limit: dailyQuota },
    );
    if (error || !data?.[0]) {
      throw new Error('Email quota reservation failed.', { cause: error });
    }
    return data[0];
  },
});

export function sendTransactionalEmail(message: TransactionalEmail) {
  return sender(message);
}
