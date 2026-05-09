import brazouLogo from "@/assets/brazou-logo.png";

const SiteFooter = () => {
  return (
    <footer className="w-full bg-surface border-t border-border">
      <div className="max-w-7xl mx-auto px-8 py-16 flex flex-col items-center gap-10">
        <img src={brazouLogo} alt="BRAZOU" className="h-8" />
        <div className="flex flex-wrap justify-center gap-12 font-semibold text-muted-foreground">
          <a className="hover:text-brand-pink transition-colors" href="#">Organizadores</a>
          <a className="hover:text-brand-pink transition-colors" href="#">Suporte</a>
          <a className="hover:text-brand-pink transition-colors" href="#">Privacidade</a>
          <a className="hover:text-brand-pink transition-colors" href="#">Termos</a>
        </div>
        <div className="w-full max-w-xs h-px bg-border" />
        <p className="text-sm font-medium text-muted-foreground">© 2024 BRAZOU. Made with passion in Brazil.</p>
      </div>
    </footer>
  );
};

export default SiteFooter;
