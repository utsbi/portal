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
import { formSchemas } from '@/data/formSchemas';

export function QuestionnaireForm({
    onClose,
    formName,
    initialData = {},
    onUpdate,
    onSubmit
}: {
    onClose?: () => void;
    formName?: string;
    initialData?: any;
    onUpdate?: (data: any) => void;
    onSubmit?: () => void;
}) {
    const schema = formName ? formSchemas[formName] : null;
    const [formData, setFormData] = useState<Record<string, any>>(initialData);

    // Update parent whenever local state changes
    useEffect(() => {
        if (onUpdate && formData) {
            onUpdate(formData);
        }
    }, [formData, onUpdate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submitted:', formData);
        if (onSubmit) onSubmit();
        if (onClose) onClose();
    };

    const handleInputChange = (id: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    if (!schema) {
        return (
            <Card className="w-full border-0 shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <CardTitle className="text-2xl font-bold text-gray-100">{formName || 'Questionnaire'}</CardTitle>
                    <CardDescription className="text-gray-400">
                        Form definition not found.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="w-full border-0 shadow-none bg-transparent">
            <CardHeader className="px-0">
                <CardTitle className="text-2xl font-bold text-gray-100">{schema.title}</CardTitle>
                <CardDescription className="text-gray-400">
                    {schema.description}
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {schema.fields.map((field) => (
                        <div key={field.id} className="space-y-2">
                            {field.type === 'section-header' ? (
                                <div className="pt-6 pb-2 border-b border-zinc-800 mb-4 first:pt-0">
                                    <h3 className="text-lg font-semibold text-gray-100 tracking-tight">{field.label}</h3>
                                    {field.description && <p className="text-sm text-gray-500 mt-1">{field.description}</p>}
                                </div>
                            ) : field.type === 'checkbox' ? (
                                <div className="flex items-start space-x-2 p-4 border border-zinc-800 rounded-md bg-zinc-900/30">
                                    <Checkbox
                                        id={field.id}
                                        checked={formData[field.id] === 'yes'}
                                        onCheckedChange={(checked) => handleInputChange(field.id, checked ? 'yes' : 'no')}
                                        className="mt-1 border-zinc-700 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900"
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor={field.id} className="text-gray-200 font-medium cursor-pointer flex items-center gap-1">
                                            {field.label}
                                            {field.required && <span className="text-red-500 font-bold">*</span>}
                                        </Label>
                                        {field.description && (
                                            <p className="text-sm text-gray-400">
                                                {field.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : field.type === 'multi-select' ? (
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium text-gray-200 flex items-center gap-1">
                                        {field.label}
                                        {field.required && <span className="text-red-500 font-bold">*</span>}
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border border-zinc-800 rounded-md bg-zinc-900/10">
                                        {field.options?.map((option) => (
                                            <div key={option} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`${field.id}-${option}`}
                                                    checked={(formData[field.id] || []).includes(option)}
                                                    onCheckedChange={(checked) => {
                                                        const current = formData[field.id] || [];
                                                        const next = checked
                                                            ? [...current, option]
                                                            : current.filter((i: string) => i !== option);
                                                        handleInputChange(field.id, next);
                                                    }}
                                                    className="border-zinc-700 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900"
                                                />
                                                <Label
                                                    htmlFor={`${field.id}-${option}`}
                                                    className="text-sm text-gray-300 font-normal cursor-pointer"
                                                >
                                                    {option}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                    {field.description && (
                                        <p className="text-xs text-gray-500">
                                            {field.description}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <Label htmlFor={field.id} className="text-sm font-medium text-gray-200 flex items-center gap-1">
                                        {field.label}
                                        {field.required && <span className="text-red-500 font-bold">*</span>}
                                    </Label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            id={field.id}
                                            placeholder={field.placeholder}
                                            rows={4}
                                            value={formData[field.id] || ''}
                                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                                            className="flex w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-gray-100 ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                                        />
                                    ) : (
                                        <Input
                                            id={field.id}
                                            type={field.type}
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ''}
                                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                                            className="bg-zinc-950/50 border-zinc-800 text-gray-100 placeholder:text-gray-500 focus-visible:ring-zinc-700"
                                        />
                                    )}
                                    {field.description && (
                                        <p className="text-xs text-gray-500">
                                            {field.description}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
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
