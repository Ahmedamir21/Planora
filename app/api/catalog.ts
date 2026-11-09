import { liveKey, redis, storageConfigured } from './admin-store';
import courses from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/courses.json';
import sch from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/sch.json';

export const bundledCatalog = { 'courses.json': courses, 'sch.json': sch };
export type CatalogFile = keyof typeof bundledCatalog;
export const isCatalogFile = (file: unknown): file is CatalogFile => file === 'courses.json' || file === 'sch.json';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!storageConfigured()) return res.status(503).json({ error: 'Live catalog unavailable.' });
  try {
    const [coursesLive, schLive] = await Promise.all([
      redis(['GET', liveKey('courses.json')]), redis(['GET', liveKey('sch.json')]),
    ]);
    return res.status(200).json({
      courses: coursesLive == null ? courses : JSON.parse(coursesLive),
      sch: schLive == null ? sch : JSON.parse(schLive),
    });
  } catch {
    console.error('Live catalog storage unavailable.');
    return res.status(503).json({ error: 'Live catalog unavailable.' });
  }
}
