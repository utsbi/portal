'use client';

import { useState, useMemo, useCallback } from 'react';
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
import { formSchemas } from '@/data/formSchemas';
import { AlertCircle } from 'lucide-react';

// Updated mock data with new columns
const initialSections = [
  { id: 1, formName: "General Form", priority: "High", status: "In Process", questionCount: 8, team: "Architecture" },
  { id: 2, formName: "Conceptual Basics", priority: "Critical", status: "In Process", questionCount: 5, team: "Architecture" },
  { id: 3, formName: "Interior Detail", priority: "High", status: "In Process", questionCount: 6, team: "Architecture" },
  { id: 4, formName: "Architecture & Aesthetic", priority: "Medium", status: "In Process", questionCount: 5, team: "Architecture" },
  { id: 5, formName: "The Estate", priority: "Medium", status: "In Process", questionCount: 7, team: "Architecture" },
];

type SortConfig = {
  key: "id" | "formName" | "priority" | "status" | "questionCount" | "team" | "missingRequired" | null;
  direction: 'asc' | 'desc';
};

const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

export default function QuestionnairePage() {
  const [sections, setSections] = useState(initialSections);
  const [allFormData, setAllFormData] = useState<Record<number, any>>({});
  const [open, setOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<typeof initialSections[0] | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [hideCompleted, setHideCompleted] = useState(false);

  const handleRowClick = (section: typeof initialSections[0]) => {
    setSelectedSection(section);
    setOpen(true);
  };

  const handleSort = (key: keyof typeof initialSections[0] | 'missingRequired') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleFormSubmit = useCallback(() => {
    if (!selectedSection) return;

    setSections(prev => prev.map(s =>
      s.id === selectedSection.id ? { ...s, status: "Done" as const } : s
    ));
  }, [selectedSection]);

  const handleFormUpdate = useCallback((data: any) => {
    if (!selectedSection) return;

    // Save the data for this section
    setAllFormData(prev => ({
      ...prev,
      [selectedSection.id]: {
        ...prev[selectedSection.id],
        ...data
      }
    }));

    if (selectedSection?.formName === "General Form") {
      const hasPool = data.hasPool === "yes";

      setSections(prev => {
        if (data.hasPool === undefined) return prev;

        const existingCivil = prev.find(s => s.formName === "Pool - Civil Engineering");

        if (hasPool && existingCivil) return prev;
        if (!hasPool && !existingCivil) return prev;

        const filtered = prev.filter(s =>
          s.formName !== "Pool - Civil Engineering" &&
          s.formName !== "Pool - Mechanical Systems" &&
          s.formName !== "Pool - Finance"
        );

        if (hasPool) {
          return [
            ...filtered,
            {
              id: 10,
              formName: "Pool - Civil Engineering",
              priority: "Medium",
              status: "In Process",
              questionCount: 2,
              team: "Engineering"
            },
            {
              id: 11,
              formName: "Pool - Mechanical Systems",
              priority: "Medium",
              status: "In Process",
              questionCount: 2,
              team: "Engineering"
            },
            {
              id: 12,
              formName: "Pool - Finance",
              priority: "Low",
              status: "In Process",
              questionCount: 1,
              team: "Finance"
            }
          ];
        } else {
          return filtered;
        }
      });
    }

    if (selectedSection?.formName === "The Estate") {
      const wantsPool = data.wantsPool === "yes";

      setSections(prev => {
        const existingPoolSpec = prev.find(s => s.formName === "Pool Specifications");

        if (wantsPool && existingPoolSpec) return prev;
        if (!wantsPool && !existingPoolSpec) return prev;

        if (wantsPool) {
          return [
            ...prev,
            {
              id: 6,
              formName: "Pool Specifications",
              priority: "High",
              status: "In Process",
              questionCount: 3,
              team: "Architecture"
            }
          ];
        } else {
          return prev.filter(s => s.formName !== "Pool Specifications");
        }
      });
    }
  }, [selectedSection]);

  const filteredAndSortedSections = useMemo(() => {
    let result = sections.map(section => {
      const schema = formSchemas[section.formName];
      const data = allFormData[section.id] || {};

      const missingRequired = schema?.fields.filter(f => f.required).some(f => {
        const val = data[f.id];
        return val === undefined || val === '' || (f.type === 'checkbox' && val === 'no');
      });

      return { ...section, missingRequired };
    });

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
  }, [sections, sortConfig, hideCompleted, allFormData]);

  return (
    <div className="flex flex-col h-full w-full p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-100">Questionnaires</h1>
          <p className="text-gray-400 mt-2">Manage and review your questionnaires.</p>
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
                <TableCell className="font-medium text-gray-200">
                  <div className="flex items-center gap-2">
                    {section.formName}
                    {section.missingRequired && (
                      <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10 h-5 px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Missing Required
                      </Badge>
                    )}
                  </div>
                </TableCell>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800 animate-in fade-in zoom-in-95 duration-300">
          <DialogHeader>
            <DialogTitle className="text-xl text-gray-100">{selectedSection?.formName}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Provide the necessary details for this project section.
            </DialogDescription>
          </DialogHeader>

          <QuestionnaireForm
            onClose={() => setOpen(false)}
            formName={selectedSection?.formName}
            initialData={selectedSection ? allFormData[selectedSection.id] : {}}
            onUpdate={handleFormUpdate}
            onSubmit={handleFormSubmit}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
