'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function QuestionnaireForm({
    onClose,
    formName,
    initialData = {},
    onUpdate
}: {
    onClose?: () => void;
    formName?: string;
    initialData?: any;
    onUpdate?: (data: any) => void;
}) {
    const [formData, setFormData] = useState({
        name: initialData.name || '',
        email: initialData.email || '',
        stuff: initialData.stuff || '',
    });
    const [hasPool, setHasPool] = useState(initialData.hasPool === 'yes');

    // Update parent whenever local state changes
    useEffect(() => {
        if (onUpdate) {
            onUpdate({
                ...formData,
                hasPool: hasPool ? 'yes' : 'no'
            });
        }
    }, [formData, hasPool]); // Careful with dependency array to avoid infinite loops if onUpdate is not stable

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submitted:', formData);
        // Handle submission logic here
        if (onClose) onClose();
    };

    const handlePoolChange = (checked: boolean) => {
        setHasPool(checked);
        // effect will handle the update
    };

    return (
        <Card className="w-full border-0 shadow-none bg-transparent">
            <CardHeader className="px-0">
                <CardTitle className="text-2xl font-bold text-gray-100">{formName || 'Questionnaire'}</CardTitle>
                <CardDescription className="text-gray-400">
                    We'd love to hear your thoughts. Please fill out the form below.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {formName === "General Form" && (
                        <div className="space-y-2 p-4 border border-zinc-800 rounded-md bg-zinc-900/30">
                            <Label className="text-base text-gray-200">Project Requirements</Label>
                            <div className="flex items-center space-x-2 mt-2">
                                <Checkbox
                                    id="pool"
                                    checked={hasPool}
                                    onCheckedChange={(checked) => handlePoolChange(checked as boolean)}
                                    className="border-zinc-700 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900"
                                />
                                <Label htmlFor="pool" className="text-gray-300 font-normal cursor-pointer">
                                    Do you want to include a pool in this project?
                                </Label>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium text-gray-200">
                            Name
                        </Label>
                        <Input
                            id="name"
                            placeholder="First Last"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="bg-zinc-950/50 border-zinc-800 text-gray-100 placeholder:text-gray-500 focus-visible:ring-zinc-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium text-gray-200">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@email.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="bg-zinc-950/50 border-zinc-800 text-gray-100 placeholder:text-gray-500 focus-visible:ring-zinc-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="stuff" className="text-sm font-medium text-gray-200">
                            Additional Comments
                        </Label>
                        <textarea
                            id="stuff"
                            placeholder="Please share any other details..."
                            rows={5}
                            value={formData.stuff}
                            onChange={(e) => setFormData({ ...formData, stuff: e.target.value })}
                            className="flex w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-gray-100 ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                        />
                    </div>


                </form>
            </CardContent>
            <CardFooter className="flex justify-end px-0">
                <Button
                    onClick={handleSubmit}
                    className="bg-white text-black hover:bg-gray-200"
                >
                    Submit
                </Button>
            </CardFooter>
        </Card>
    );
}
