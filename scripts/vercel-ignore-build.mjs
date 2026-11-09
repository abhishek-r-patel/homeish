// Vercel exit 0 skips a Git build; exit 1 builds the project's release branch.
const deployment = process.env.APP_DEPLOYMENT;
const branch = process.env.VERCEL_GIT_COMMIT_REF;

if (deployment !== 'shared' && deployment !== 'beta') {
  console.error('Set APP_DEPLOYMENT to shared or beta before deploying.');
  process.exit(0);
}

const expectedBranch = deployment === 'beta' ? 'beta' : 'main';
const build = !branch || branch === expectedBranch;
console.log(
  build ? `Building ${deployment}.` : `Skipping ${branch} on ${deployment}.`,
);
process.exit(build ? 1 : 0);
