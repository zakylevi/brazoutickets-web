import HeroCarousel from "@/components/HeroCarousel";
import CategoryPills from "@/components/CategoryPills";
import TrendingEvents from "@/components/TrendingEvents";
import EventsNearYou from "@/components/EventsNearYou";
import TopOrganizers from "@/components/TopOrganizers";
const Index = () => {
  return (
    <main>
      <HeroCarousel />
      <CategoryPills />
      <TrendingEvents />
      <EventsNearYou />
      <TopOrganizers />
    </main>
  );
};

export default Index;
