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
import { useState } from 'react';

export default function QuestionnairePage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    feedback: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Handle submission logic here
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full w-full py-12">
      <div className="w-full max-w-2xl px-4">
        <Card className="w-full bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-100">Questionnaire</CardTitle>
            <CardDescription className="text-gray-400">
              We'd love to hear your thoughts. Please fill out the form below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-200">
                  Name
                </label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-zinc-950/50 border-zinc-800 text-gray-100 placeholder:text-gray-500 focus-visible:ring-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-200">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-zinc-950/50 border-zinc-800 text-gray-100 placeholder:text-gray-500 focus-visible:ring-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="feedback" className="text-sm font-medium text-gray-200">
                  Feedback
                </label>
                <textarea
                  id="feedback"
                  placeholder="Tell us what you think..."
                  rows={5}
                  value={formData.feedback}
                  onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                  className="flex w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-gray-100 ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                />
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              onClick={handleSubmit}
              className="bg-white text-black hover:bg-gray-200"
            >
              Submit Feedback
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
