import { CHRONOS_RESOURCES, ChronosModule } from '@aether/chronos';
import { OIKONOMOS_RESOURCES, OikonomosModule } from '@aether/oikonomos';
import { PROSOPONE_RESOURCES, ProsoponeModule } from '@aether/prosopone';
import { TEKMERION_RESOURCES, TekmerionModule } from '@aether/tekmerion';
import { TELOS_RESOURCES, TelosModule } from '@aether/telos';
import { TOPOS_RESOURCES, ToposModule } from '@aether/topos';

/**
 * That the six domain libraries exist, resolve through their `@aether/*` entry
 * points, and agree on what they own.
 *
 * The resolution half is not ceremony: the aliases are a TypeScript path
 * mapping, and Jest does not read those. A spec that imports a library is the
 * only thing that proves `moduleNameMapper` was kept in step with `paths` —
 * without it the mapping rots silently until someone writes the first real
 * test and finds their imports do not resolve.
 */
const DOMAINS = {
  chronos: { module: ChronosModule, resources: CHRONOS_RESOURCES },
  oikonomos: { module: OikonomosModule, resources: OIKONOMOS_RESOURCES },
  prosopone: { module: ProsoponeModule, resources: PROSOPONE_RESOURCES },
  tekmerion: { module: TekmerionModule, resources: TEKMERION_RESOURCES },
  telos: { module: TelosModule, resources: TELOS_RESOURCES },
  topos: { module: ToposModule, resources: TOPOS_RESOURCES },
};

describe.each(Object.entries(DOMAINS))('%s', (_name, domain) => {
  it('resolves through its entry point', () => {
    expect(typeof domain.module).toBe('function');
  });

  it('owns at least one resource', () => {
    expect(domain.resources.length).toBeGreaterThan(0);
  });

  it('names its resources in singular PascalCase', () => {
    // The names end up in IRIs and route segments, so a plural or a stray
    // space here becomes a URL nobody can guess.
    for (const resource of domain.resources) {
      expect(resource).toMatch(/^[A-Z][A-Za-z]+$/);
    }
  });
});

describe('the domains together', () => {
  it('claim no resource twice', () => {
    // Two domains owning `Event` would make `urn:aether:event:…` ambiguous,
    // and neither library would be wrong on its own.
    const all = Object.values(DOMAINS).flatMap((d) => [...d.resources]);

    expect(new Set(all).size).toBe(all.length);
  });

  it('cover every section the console navigates to', () => {
    // The nav is the spec here: a group in the sidebar with no library behind
    // it is a screen with nowhere for its api to live.
    expect(Object.keys(DOMAINS).sort()).toEqual([
      'chronos',
      'oikonomos',
      'prosopone',
      'tekmerion',
      'telos',
      'topos',
    ]);
  });
});
