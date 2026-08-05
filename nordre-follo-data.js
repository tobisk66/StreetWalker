const explicitNames = [
  'Akerveien', 'Akselstadvn', 'Alfaset', 'Almeveien', 'Amundsens vei', 'Andersens vei', 'Ansveien', 'Arnes vei', 'Askvollveien', 'Askveien', 'Auliveien', 'Bakkenveien', 'Barkveien', 'Bekkestua', 'Bergsjøveien', 'Bergveien', 'Bjørkebakken', 'Bjørkåsvegen', 'Bjørkåsveien', 'Bjørndalveien', 'Bjørnsrudveien', 'Bjørnstadveien', 'Borgenveien', 'Brenndalsveien', 'Brøsetveien', 'Bølerveien', 'Cederveien', 'Dalsrudveien', 'Dalsveien', 'Dammenveien', 'Dønnveien', 'Eikerveien', 'Eikveien', 'Ellingsrudveien', 'Fetsundveien', 'Fjellveien', 'Folloveien', 'Fossumveien', 'Fossvegen', 'Fossveien', 'Galtveien', 'Gjøvikveien', 'Granveien', 'Grønvollveien', 'Guldsmedveien', 'Gåseveien', 'Hagenveien', 'Haugerveien', 'Haugsveien', 'Haugveien', 'Hellerudveien', 'Holtveien', 'Holmenveien', 'Hovseterveien', 'Hvitsteinveien', 'Høgåsveien', 'Høvikveien', 'Ildveien', 'Jonsrudveien', 'Kirkebakken', 'Kjellervn', 'Kjellerveien', 'Kongeskogen', 'Kongshavnveien', 'Krokstadvn', 'Kråkerøyveien', 'Kråkstadveien', 'Kråkvollveien', 'Kvernveien', 'Lierveien', 'Lindveien', 'Lofotveien', 'Lundervollveien', 'Langåsveien', 'Løkenvegen', 'Løkenveien', 'Lønnstigen', 'Lønnveien', 'Malmveien', 'Mellomveien', 'Mosseveien', 'Myrdalveien', 'Myrhaugveien', 'Myrvollveien', 'Nedre Vollen', 'Nesbakken', 'Nesøveien', 'Nordre Åsen', 'Nordre Vollen', 'Nordkroken', 'Nyborgveien', 'Oppdalsveien', 'Ormåsenveien', 'Osloveien', 'Pukerveien', 'Ragnhilds vei', 'Rådhusveien', 'Rådalveien', 'Rødtangenveien', 'Rønningsveien', 'Røstadveien', 'Rødveien', 'Sanderveien', 'Sagtjernetveien', 'Skarpsnoveien', 'Skarvegen', 'Skarveien', 'Skiveien', 'Skullerudveien', 'Solheimveien', 'Sondreveien', 'Sørgårdsveien', 'Sørkroken', 'Sørensenveien', 'Stensrudveien', 'Søndre Veien', 'Søndreveien', 'Tangenveien', 'Tingveien', 'Torgveien', 'Tømmeråsveien', 'Ulvenveien', 'Vardåsen', 'Vardåsenveien', 'Vevelstadveien', 'Vestkroken', 'Vestveien', 'Vestreveien', 'Vetterveien', 'Vollenveien', 'Vålveien', 'Østkroken', 'Østervollveien', 'Øvre Vollen', 'Årøveien', 'Åsveien', 'Åsvegen'
];

const nordreFolloStreets = explicitNames.map((name, index) => ({
  id: `nf-${String(index + 1).padStart(3, '0')}`,
  name,
  municipality: 'Nordre Follo',
  coverage: 0,
  sortOrder: index,
}));

if (typeof window !== 'undefined') {
  window.NORDRE_FOLLO_STREETS = [];
  window.NORDRE_FOLLO_STREET_NAMES = [];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { nordreFolloStreets };
}
