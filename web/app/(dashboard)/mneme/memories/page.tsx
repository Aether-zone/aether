import { Heading } from '@aether-zone/kosmos';

import { getSession } from '@/lib/auth';

import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

export default async function MemoriesPage() {
  const session = await getSession();

  // The layout has already redirected anyone without one; this is for the type.
  if (!session) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBreadcrumbs />

      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Mneme &gt; Memories
        </Heading>
      </div>
    </div>
  );
}
