export function SponsorLogo() {
  return (
    <div className="flex-shrink-0 self-start md:self-end">
      <a
        href="https://fundyflightdiscs.ca/"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white rounded-2xl shadow-xl px-4 pt-3 pb-4 flex flex-col items-center gap-2 hover:shadow-2xl transition-shadow"
      >
        <p className="text-[#1a3355] text-xs font-semibold uppercase tracking-widest">Presented by</p>
        <div className="bg-[#1a3355] rounded-full p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/FFD_Logo.avif"
            alt="Fundy Flight Discs"
            className="w-14 md:w-24 h-auto rounded-full"
          />
        </div>
      </a>
    </div>
  );
}
