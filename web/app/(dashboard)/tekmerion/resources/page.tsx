import {
    Heading,
} from '@aether-zone/kosmos';

import { getSession } from '@/lib/auth';

export default async function ResourcesPage() {

    const session = await getSession()

    // The layout has already redirected anyone without one; this is for the type.
    if (!session) {
        return null;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <Heading level={1} size="heading-large">
                    Tekmerion &gt; Resources
                </Heading>
            </div>
        </div>
    );
}
