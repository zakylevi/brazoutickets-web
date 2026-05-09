import { useNavigate } from "react-router-dom";

const ForOrganizers = () => {
  const navigate = useNavigate();

  return (
    <main className="pt-32 px-6 lg:px-12 max-w-7xl mx-auto pb-20">
      {/* Hero Intro */}
      <header className="mb-24 text-center max-w-3xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1] text-foreground">
          Sell More Tickets.
          <br />
          <span className="text-brand-pink">Build Your Community</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-light">
          The all-in-one platform to create, grow, and scale your events.
        </p>
      </header>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
        {/* Smart Ticketing */}
        <section className="md:col-span-7 bg-card rounded-3xl p-10 flex flex-col justify-between overflow-hidden relative group transition-all duration-500 hover:bg-secondary/50 border border-border">
          <div className="relative z-10">
            <div className="w-12 h-12 bg-brand-pink/10 rounded-2xl flex items-center justify-center mb-8">
              <svg className="w-6 h-6 text-brand-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-4 tracking-tight text-foreground">Smart Ticketing</h2>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              Effortless checkout flows with dynamic pricing and fraud
              protection. Designed to get your guests from discovery to ticket
              in under 30 seconds.
            </p>
          </div>
          <div className="mt-12 -mb-20 -mr-20 self-end transition-transform duration-700 group-hover:scale-105">
            <div className="bg-secondary p-4 rounded-tl-3xl shadow-2xl w-80 h-64 border border-border/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-brand-lime" />
                <div className="h-2 w-24 bg-muted rounded-full" />
              </div>
              <div className="space-y-4">
                <div className="h-10 w-full bg-card rounded-xl flex items-center px-4 border border-border/40">
                  <svg className="w-4 h-4 mr-2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="h-2 w-16 bg-muted rounded-full" />
                </div>
                <div className="h-10 w-full bg-brand-pink text-white rounded-xl flex items-center justify-center font-bold text-sm">
                  Purchase Confirmed
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Promoter System */}
        <section className="md:col-span-5 bg-card rounded-3xl p-10 flex flex-col transition-all duration-500 hover:bg-secondary/50 border border-border">
          <div className="w-12 h-12 bg-brand-lime/20 rounded-2xl flex items-center justify-center mb-8">
            <svg className="w-6 h-6 text-brand-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight text-foreground">Promoter System</h2>
          <p className="text-muted-foreground leading-relaxed mb-10">
            Scale your reach through curated networking. Automate commissions
            and track influencer performance in a dedicated portal.
          </p>
          <div className="mt-auto flex -space-x-4">
            <div className="w-14 h-14 rounded-full border-4 border-card bg-brand-pink/20 flex items-center justify-center text-brand-pink font-bold text-sm">A</div>
            <div className="w-14 h-14 rounded-full border-4 border-card bg-brand-lime/20 flex items-center justify-center text-foreground font-bold text-sm">B</div>
            <div className="w-14 h-14 rounded-full border-4 border-card bg-primary/20 flex items-center justify-center text-foreground font-bold text-sm">C</div>
            <div className="w-14 h-14 rounded-full bg-secondary border-4 border-card flex items-center justify-center text-xs font-bold text-muted-foreground">
              +12
            </div>
          </div>
        </section>

        {/* Real-time Sales */}
        <section className="md:col-span-12 bg-foreground text-background rounded-3xl p-10 lg:p-16 flex flex-col lg:flex-row items-center gap-12 overflow-hidden relative">
          <div className="lg:w-1/2 relative z-10">
            <div className="inline-flex items-center gap-2 bg-brand-lime px-4 py-1.5 rounded-full text-xs font-black mb-8 uppercase tracking-widest text-black">
              <span className="w-2 h-2 rounded-full bg-black" /> Live Now
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
              Real-time Sales
            </h2>
            <p className="text-background/60 text-lg leading-relaxed mb-8">
              Watch your event come to life. Our sleek dashboard provides
              instant heatmaps and sales velocity metrics as they happen.
            </p>
            <div className="flex gap-4">
              <div className="bg-background/10 backdrop-blur-md p-4 rounded-2xl border border-background/10">
                <div className="text-background/60 text-xs mb-1 uppercase tracking-widest font-bold">
                  Revenue
                </div>
                <div className="text-2xl font-bold text-brand-lime">
                  R$ 142.8k
                </div>
              </div>
              <div className="bg-background/10 backdrop-blur-md p-4 rounded-2xl border border-background/10">
                <div className="text-background/60 text-xs mb-1 uppercase tracking-widest font-bold">
                  Sold
                </div>
                <div className="text-2xl font-bold">84%</div>
              </div>
            </div>
          </div>
          <div className="lg:w-1/2 w-full">
            <div className="relative bg-background/10 rounded-3xl p-6 border border-background/10 backdrop-blur-sm">
              <div className="flex items-end gap-2 h-48">
                <div className="flex-1 bg-background/20 rounded-t-lg h-1/4" />
                <div className="flex-1 bg-background/20 rounded-t-lg h-2/4" />
                <div className="flex-1 bg-brand-pink rounded-t-lg h-3/4" />
                <div className="flex-1 bg-brand-lime rounded-t-lg h-full" />
                <div className="flex-1 bg-background/20 rounded-t-lg h-2/4" />
                <div className="flex-1 bg-brand-pink rounded-t-lg h-4/5" />
                <div className="flex-1 bg-background/20 rounded-t-lg h-1/3" />
              </div>
              <div className="mt-4 flex justify-between text-[10px] text-background/50 font-bold tracking-tighter uppercase">
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>Now</span>
              </div>
            </div>
          </div>
        </section>

        {/* High Conversion SMS */}
        <section className="md:col-span-6 bg-secondary rounded-3xl p-10 flex flex-col justify-between transition-all duration-500 hover:bg-secondary/80 border border-border">
          <div>
            <div className="w-12 h-12 bg-foreground/5 rounded-2xl flex items-center justify-center mb-8">
              <svg className="w-6 h-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-4 tracking-tight text-foreground">
              High Conversion SMS
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              98% open rates that drive immediate action. Send targeted drops to
              your most loyal fans exactly when the hype is peaking.
            </p>
          </div>
          <div className="mt-12 bg-card rounded-2xl p-6 shadow-sm border border-border/40">
            <div className="text-[10px] font-black text-brand-pink mb-2 uppercase tracking-widest">
              New Campaign
            </div>
            <div className="text-sm font-medium leading-snug text-foreground">
              "Final 100 tickets for Sunset Sessions. Click to secure yours
              now!"
            </div>
          </div>
        </section>

        {/* Design & Data */}
        <section className="md:col-span-6 bg-card rounded-3xl p-10 flex flex-col justify-between transition-all duration-500 hover:bg-secondary/50 border border-border">
          <div>
            <div className="w-12 h-12 bg-foreground/5 rounded-2xl flex items-center justify-center mb-8">
              <svg className="w-6 h-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-4 tracking-tight text-foreground">
              Design & Data
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Where aesthetics meet intelligence. Beautiful event pages that
              gather deep behavioral insights without sacrificing style.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4">
            <div className="h-2 bg-brand-pink rounded-full w-full" />
            <div className="h-2 bg-foreground/10 rounded-full w-full" />
            <div className="h-2 bg-brand-lime rounded-full w-3/4" />
            <div className="h-2 bg-foreground/10 rounded-full w-full" />
          </div>
        </section>
      </div>

      {/* CTA */}
      <section className="mt-32 mb-16 text-center">
        <h3 className="text-4xl font-bold mb-8 text-foreground">
          Start Building Your Event Today
        </h3>
        <button
          onClick={() => navigate("/auth")}
          className="px-12 py-5 bg-gradient-to-r from-brand-pink to-brand-pink/80 text-white rounded-full text-lg font-bold shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
        >
          Create Your Event
        </button>
      </section>
    </main>
  );
};

export default ForOrganizers;
