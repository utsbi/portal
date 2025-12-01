'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Check } from 'lucide-react';
import { QuestionnaireForm } from '@/components/QuestionnaireForm';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Updated mock data with new columns
const sections = [
  { id: 1, formName: "Cover page", priority: "High", status: "In Process", questionCount: 5, team: "Design Team" },
  { id: 2, formName: "Table of contents", priority: "Medium", status: "Done", questionCount: 0, team: "Design Team" },
  { id: 3, formName: "Executive summary", priority: "High", status: "Done", questionCount: 3, team: "Executive Team" },
  { id: 4, formName: "Technical approach", priority: "Critical", status: "Done", questionCount: 12, team: "Engineering" },
  { id: 5, formName: "Design", priority: "Medium", status: "In Process", questionCount: 8, team: "Design Team" },
  { id: 6, formName: "Capabilities", priority: "Low", status: "In Process", questionCount: 15, team: "Product" },
  { id: 7, formName: "Integration with existing systems", priority: "Critical", status: "In Process", questionCount: 20, team: "Engineering" },
  { id: 8, formName: "Innovation and Advantages", priority: "Medium", status: "Done", questionCount: 6, team: "R&D" },
  { id: 9, formName: "Overview of EMR's Innovative Solutions", priority: "Low", status: "Done", questionCount: 4, team: "R&D" },
  { id: 10, formName: "Advanced Algorithms and Machine Learning", priority: "High", status: "Done", questionCount: 10, team: "Data Science" },
];

type SortConfig = {
  key: keyof typeof sections[0] | null;
  direction: 'asc' | 'desc';
};

const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

export default function QuestionnairePage() {
  const [open, setOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<typeof sections[0] | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [hideCompleted, setHideCompleted] = useState(false);

  const handleRowClick = (section: typeof sections[0]) => {
    setSelectedSection(section);
    setOpen(true);
  };

  const handleSort = (key: keyof typeof sections[0]) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedSections = useMemo(() => {
    let result = [...sections];

    if (hideCompleted) {
      result = result.filter(section => section.status !== 'Done');
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (sortConfig.key === 'priority') {
          const aPriority = priorityOrder[aValue as keyof typeof priorityOrder] ?? 99;
          const bPriority = priorityOrder[bValue as keyof typeof priorityOrder] ?? 99;
          if (aPriority < bPriority) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aPriority > bPriority) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [sortConfig, hideCompleted]);

  return (
    <div className="flex flex-col h-full w-full p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-100">Proposal Sections</h1>
          <p className="text-gray-400 mt-2">Manage and review your proposal sections.</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 mr-4">
            <Checkbox
              id="hide-completed"
              checked={hideCompleted}
              onCheckedChange={(checked) => setHideCompleted(checked as boolean)}
              className="border-zinc-700 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900"
            />
            <Label htmlFor="hide-completed" className="text-gray-300 cursor-pointer">
              Hide Completed
            </Label>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-950/50">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="text-gray-400">Form Name</TableHead>
              <TableHead className="text-gray-400 cursor-pointer hover:text-white" onClick={() => handleSort('priority')}>
                <div className="flex items-center gap-1">
                  Priority/Deadline
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-gray-400 cursor-pointer hover:text-white" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">
                  Status
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-gray-400 text-right cursor-pointer hover:text-white" onClick={() => handleSort('questionCount')}>
                <div className="flex items-center justify-end gap-1">
                  Number of Questions
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-gray-400 cursor-pointer hover:text-white" onClick={() => handleSort('team')}>
                <div className="flex items-center gap-1">
                  What team this is for
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedSections.map((section) => (
              <TableRow
                key={section.id}
                className="border-zinc-800 cursor-pointer hover:bg-zinc-900/50 transition-colors"
                onClick={() => handleRowClick(section)}
              >
                <TableCell>
                  <div className="h-4 w-4 rounded border border-zinc-700" />
                </TableCell>
                <TableCell className="font-medium text-gray-200">{section.formName}</TableCell>
                <TableCell>
                  <span className={
                    section.priority === 'Critical' ? 'text-red-400 font-medium' :
                      section.priority === 'High' ? 'text-orange-400' :
                        'text-gray-400'
                  }>
                    {section.priority}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {section.status === 'Done' ? (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    )}
                    <span className={section.status === 'Done' ? 'text-green-500' : 'text-yellow-500'}>
                      {section.status}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-gray-400">{section.questionCount}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-zinc-900 text-gray-400 border-zinc-700 hover:bg-zinc-900">
                    {section.team}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl text-gray-100">{selectedSection?.formName}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Edit the details and questionnaire for this section.
            </DialogDescription>
          </DialogHeader>

          <QuestionnaireForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
