// Shared Homeish mark rendered into installable PNG icon sizes.
export function AppIconMark() {
  return (
    <div
      style={{
        alignItems: 'center',
        backgroundColor: '#1e4e8c',
        borderRadius: '22%',
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <svg fill="none" viewBox="0 0 512 512" width="72%" height="72%">
        <path
          d="M88 252 256 112l168 140M132 232v168h248V232M210 400V286h92v114"
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />
        <circle cx="256" cy="254" r="11" fill="#ffd966" />
      </svg>
    </div>
  );
}
