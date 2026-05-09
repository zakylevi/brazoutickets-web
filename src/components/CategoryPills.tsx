import { PartyPopper, Drama, Music, Briefcase, Heart, Tent } from "lucide-react";
import { useNavigate } from "react-router-dom";

const categories = [
  { icon: PartyPopper, label: "PARTY", value: "Party" },
  { icon: Drama, label: "COMEDY", value: "Comedy" },
  { icon: Music, label: "CONCERT", value: "Concert" },
  { icon: Briefcase, label: "BUSINESS", value: "Business" },
  { icon: Heart, label: "WELLNESS", value: "Wellness" },
  { icon: Tent, label: "FESTIVAL", value: "Festival" },
];

const CategoryPills = () => {
  const navigate = useNavigate();

  return (
    <section className="py-12 bg-surface">
      <div className="max-w-7xl mx-auto px-6 overflow-x-auto hide-scrollbar flex gap-4 justify-center">
        {categories.map((cat) => (
          <button
            key={cat.label}
            onClick={() => navigate(`/explore?category=${encodeURIComponent(cat.value)}`)}
            className="flex items-center gap-3 px-6 py-3 rounded-full bg-secondary border border-border hover:border-brand-pink hover:bg-surface hover:shadow-md transition-all group"
          >
            <cat.icon className="w-5 h-5 text-muted-foreground group-hover:text-brand-pink transition-colors" />
            <span className="text-sm font-bold tracking-tight text-foreground">{cat.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default CategoryPills;
