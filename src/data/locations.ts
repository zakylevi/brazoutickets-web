export interface Country {
  name: string;
  states: string[];
}

export interface Region {
  name: string;
  countries: Country[];
}

export const regions: Region[] = [
  {
    name: "South America",
    countries: [
      { name: "Brazil", states: ["São Paulo", "Rio de Janeiro", "Minas Gerais", "Bahia", "Paraná", "Rio Grande do Sul", "Pernambuco", "Ceará", "Pará", "Santa Catarina", "Goiás", "Maranhão", "Amazonas", "Espírito Santo", "Mato Grosso", "Mato Grosso do Sul", "Distrito Federal", "Paraíba", "Sergipe", "Alagoas", "Piauí", "Tocantins", "Rondônia", "Acre", "Amapá", "Roraima"] },
      { name: "Argentina", states: ["Buenos Aires", "Córdoba", "Santa Fe", "Mendoza", "Tucumán", "Salta", "Misiones", "Chaco", "Entre Ríos"] },
      { name: "Colombia", states: ["Bogotá", "Antioquia", "Valle del Cauca", "Atlántico", "Santander", "Cundinamarca"] },
      { name: "Chile", states: ["Santiago", "Valparaíso", "Biobío", "Maule", "Araucanía"] },
      { name: "Peru", states: ["Lima", "Arequipa", "La Libertad", "Cusco", "Piura"] },
      { name: "Venezuela", states: ["Caracas", "Zulia", "Miranda", "Carabobo", "Lara"] },
      { name: "Ecuador", states: ["Guayaquil", "Quito", "Cuenca"] },
      { name: "Uruguay", states: ["Montevideo", "Canelones", "Maldonado"] },
      { name: "Paraguay", states: ["Asunción", "Central", "Alto Paraná"] },
      { name: "Bolivia", states: ["La Paz", "Santa Cruz", "Cochabamba"] },
    ],
  },
  {
    name: "North America",
    countries: [
      { name: "United States", states: ["California", "New York", "Texas", "Florida", "Illinois", "Pennsylvania", "Ohio", "Georgia", "North Carolina", "Michigan", "New Jersey", "Virginia", "Washington", "Arizona", "Massachusetts", "Tennessee", "Indiana", "Missouri", "Maryland", "Wisconsin", "Colorado", "Minnesota", "South Carolina", "Alabama", "Louisiana", "Kentucky", "Oregon", "Oklahoma", "Connecticut", "Utah", "Nevada", "Iowa", "Arkansas", "Mississippi", "Kansas", "New Mexico", "Nebraska", "Hawaii", "Idaho", "West Virginia"] },
      { name: "Canada", states: ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", "Nova Scotia", "New Brunswick"] },
      { name: "Mexico", states: ["Ciudad de México", "Jalisco", "Nuevo León", "Estado de México", "Puebla", "Guanajuato", "Chihuahua", "Veracruz", "Quintana Roo"] },
    ],
  },
  {
    name: "Europe",
    countries: [
      { name: "United Kingdom", states: ["England", "Scotland", "Wales", "Northern Ireland"] },
      { name: "France", states: ["Île-de-France", "Provence-Alpes-Côte d'Azur", "Auvergne-Rhône-Alpes", "Nouvelle-Aquitaine", "Occitanie"] },
      { name: "Germany", states: ["Bavaria", "Berlin", "North Rhine-Westphalia", "Baden-Württemberg", "Lower Saxony", "Hesse", "Saxony", "Hamburg"] },
      { name: "Spain", states: ["Madrid", "Catalonia", "Andalusia", "Valencia", "Basque Country", "Galicia"] },
      { name: "Italy", states: ["Lombardy", "Lazio", "Campania", "Sicily", "Veneto", "Piedmont", "Tuscany"] },
      { name: "Portugal", states: ["Lisbon", "Porto", "Algarve", "Braga", "Coimbra"] },
      { name: "Netherlands", states: ["North Holland", "South Holland", "Utrecht", "North Brabant"] },
      { name: "Belgium", states: ["Brussels", "Flanders", "Wallonia"] },
      { name: "Sweden", states: ["Stockholm", "Västra Götaland", "Skåne"] },
      { name: "Norway", states: ["Oslo", "Vestland", "Trøndelag"] },
      { name: "Denmark", states: ["Capital Region", "Central Denmark", "Southern Denmark"] },
      { name: "Finland", states: ["Uusimaa", "Pirkanmaa", "Southwest Finland"] },
      { name: "Switzerland", states: ["Zurich", "Bern", "Geneva", "Vaud", "Basel"] },
      { name: "Austria", states: ["Vienna", "Upper Austria", "Tyrol", "Styria"] },
      { name: "Poland", states: ["Masovia", "Lesser Poland", "Greater Poland", "Silesia"] },
      { name: "Czech Republic", states: ["Prague", "Central Bohemia", "South Moravia"] },
      { name: "Ireland", states: ["Dublin", "Cork", "Galway"] },
      { name: "Greece", states: ["Attica", "Central Macedonia", "Crete"] },
      { name: "Romania", states: ["Bucharest", "Cluj", "Timișoara"] },
      { name: "Hungary", states: ["Budapest", "Pest", "Hajdú-Bihar"] },
    ],
  },
  {
    name: "Asia",
    countries: [
      { name: "Japan", states: ["Tokyo", "Osaka", "Kyoto", "Hokkaido", "Fukuoka", "Kanagawa"] },
      { name: "South Korea", states: ["Seoul", "Busan", "Incheon", "Daegu"] },
      { name: "China", states: ["Beijing", "Shanghai", "Guangdong", "Sichuan", "Zhejiang"] },
      { name: "India", states: ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Telangana", "West Bengal", "Gujarat", "Rajasthan", "Uttar Pradesh", "Kerala"] },
      { name: "Thailand", states: ["Bangkok", "Chiang Mai", "Phuket", "Pattaya"] },
      { name: "Indonesia", states: ["Jakarta", "Bali", "West Java", "East Java"] },
      { name: "Philippines", states: ["Metro Manila", "Cebu", "Davao"] },
      { name: "Vietnam", states: ["Ho Chi Minh City", "Hanoi", "Da Nang"] },
      { name: "Malaysia", states: ["Kuala Lumpur", "Selangor", "Penang", "Johor"] },
      { name: "Singapore", states: ["Singapore"] },
      { name: "Taiwan", states: ["Taipei", "Kaohsiung", "Taichung"] },
      { name: "United Arab Emirates", states: ["Dubai", "Abu Dhabi", "Sharjah"] },
      { name: "Saudi Arabia", states: ["Riyadh", "Jeddah", "Dammam"] },
      { name: "Israel", states: ["Tel Aviv", "Jerusalem", "Haifa"] },
      { name: "Turkey", states: ["Istanbul", "Ankara", "Izmir", "Antalya"] },
    ],
  },
  {
    name: "Africa",
    countries: [
      { name: "South Africa", states: ["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape"] },
      { name: "Nigeria", states: ["Lagos", "Abuja", "Rivers", "Kano"] },
      { name: "Kenya", states: ["Nairobi", "Mombasa", "Kisumu"] },
      { name: "Egypt", states: ["Cairo", "Alexandria", "Giza"] },
      { name: "Morocco", states: ["Casablanca", "Rabat", "Marrakech", "Tangier"] },
      { name: "Ghana", states: ["Greater Accra", "Ashanti", "Western"] },
      { name: "Tanzania", states: ["Dar es Salaam", "Dodoma", "Zanzibar"] },
      { name: "Ethiopia", states: ["Addis Ababa", "Oromia", "Amhara"] },
    ],
  },
  {
    name: "Oceania",
    countries: [
      { name: "Australia", states: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania"] },
      { name: "New Zealand", states: ["Auckland", "Wellington", "Canterbury", "Waikato"] },
    ],
  },
];
