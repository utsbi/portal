'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export function PoolSurvey() {
    const [includePool, setIncludePool] = useState(false);

    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="preferences" className="border-zinc-800">
                <AccordionTrigger className="text-gray-200 hover:text-gray-100 hover:no-underline">
                    Preferences
                </AccordionTrigger>
                <AccordionContent className="text-gray-300">
                    <div className="flex items-center space-x-2 py-4">
                        <Checkbox
                            id="include-pool"
                            checked={includePool}
                            onCheckedChange={(checked) => setIncludePool(checked as boolean)}
                            className="border-zinc-700 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900"
                        />
                        <Label htmlFor="include-pool" className="text-gray-200">
                            Include Pool?
                        </Label>
                    </div>
                </AccordionContent>
            </AccordionItem>

            {includePool && (
                <AccordionItem value="pool-config" className="border-zinc-800">
                    <AccordionTrigger className="text-gray-200 hover:text-gray-100 hover:no-underline">
                        Pool Configuration
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-300">
                        <div className="space-y-4 py-4">
                            <p className="text-sm text-gray-400">
                                pool information, blah, blah, blah.
                            </p>

                            {/* so questions would go here */}

                            <div className="grid gap-2">
                                <Label className="text-gray-200">Pool Type</Label>
                                <div className="text-sm text-gray-500">
                                    (pool questions, blah, blah, blah.)
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
        </Accordion>
    );
}
