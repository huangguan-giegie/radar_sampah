import { REGIONS, type CoastalBeach } from './coastalData';

/** Search the whole catalogue even while the map is focused on one region. */
export function searchBeaches(beaches: readonly CoastalBeach[], query: string): CoastalBeach[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return beaches.filter(beach => {
    const region = beach.region === 'borneo' ? 'Borneo' : REGIONS.find(item => item.id === beach.region)?.name ?? '';
    const value = `${beach.name} ${beach.area} ${region}`.toLocaleLowerCase();
    return words.every(word => value.includes(word));
  });
}

export function borneoReportCounts(beaches: readonly CoastalBeach[]) {
  const rows = beaches.filter(beach => beach.region === 'borneo');
  return {
    total: rows.reduce((sum, beach) => sum + beach.validReports, 0),
    sabah: rows.filter(beach => /sabah/i.test(beach.area)).reduce((sum, beach) => sum + beach.validReports, 0),
    sarawak: rows.filter(beach => /sarawak/i.test(beach.area)).reduce((sum, beach) => sum + beach.validReports, 0),
  };
}
