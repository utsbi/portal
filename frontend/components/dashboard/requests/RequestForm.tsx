"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Send } from "lucide-react";
import { FileUpload } from "./FileUpload";

const departmentOptions = [
    { value: "n/a", label: "N/A" },
    { value: "engineering", label: "Engineering" },
    { value: "architecture", label: "Architecture" },
    { value: "tech", label: "Tech" },
    { value: "business", label: "Business" },
    { value: "pr", label: "PR" },
    { value: "research", label: "Research and Development" },
    { value: "legal", label: "Legal" },
];

const teamMembers = [
    { value: "pedro", label: "Pedro Guzman - President", department: "n/a" },
    { value: "sam", label: "Sam Moran - Vice President", department: "n/a" },
    { value: "brendan", label: "Brendan Lyon - Director of Project Operations", department: "engineering" }, // Using engineering as default for Project Ops unless specified
    { value: "kabir", label: "Kabir Muzumdar - Director of Civil Engineering", department: "engineering" },
    { value: "preston", label: "Preston Vajdos - Director of Civil Engineering", department: "engineering" },
    { value: "enoch", label: "Enoch Zhu - Director of External Technologies", department: "tech" },
    { value: "daniel", label: "Daniel Lam - Director of Internal Technologies", department: "tech" },
    { value: "dev", label: "Dev Shroff - Director of Business", department: "business" },
    { value: "arianne", label: "Arianne Yude - Director of Public Relations", department: "pr" },
    { value: "christian", label: "Christian Butler - Director of Architecture", department: "architecture" },
    { value: "alim", label: "Alim Makanov - Director of Legal", department: "legal" },
];

interface RequestFormProps {
    onSubmit?: (data: any) => void;
}

export function RequestForm({ onSubmit }: RequestFormProps) {
    const [formState, setFormState] = useState({
        name: "",
        email: "",
        subject: "",
        department: "n/a",
        assignedTo: "",
        project: "",
        message: "",
    });
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resetKey, setResetKey] = useState(0);

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
    ) => {
        const { name, value } = e.target;
        setFormState((prev) => {
            const updates = { ...prev, [name]: value };
            // Auto-reset assignedTo when department changes, unless the new department is 'n/a'
            if (name === "department") {
                updates.assignedTo = "";
            }
            return updates;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        await onSubmit?.({
            ...formState,
            attachments: files,
            createdAt: new Date(),
            status: "pending",
        });

        // Reset form
        setFormState({
            name: "",
            email: "",
            subject: "",
            department: "n/a",
            assignedTo: "",
            project: "",
            message: "",
        });
        setFiles([]);
        setResetKey((k) => k + 1); // Forces FileUpload to remount and clear
        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Name and Email row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label
                        htmlFor="name"
                        className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3 group-focus-within:text-sbi-green transition-colors"
                    >
                        Name
                    </label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formState.name}
                        onChange={handleChange}
                        required
                        className="w-full py-3 bg-transparent border-b border-sbi-dark-border focus:border-sbi-green focus:outline-none text-white placeholder:text-sbi-muted/40 transition-colors"
                        placeholder="Your name"
                    />
                </div>

                <div className="group">
                    <label
                        htmlFor="email"
                        className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3 group-focus-within:text-sbi-green transition-colors"
                    >
                        Email
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formState.email}
                        onChange={handleChange}
                        required
                        className="w-full py-3 bg-transparent border-b border-sbi-dark-border focus:border-sbi-green focus:outline-none text-white placeholder:text-sbi-muted/40 transition-colors"
                        placeholder="your@email.com"
                    />
                </div>
            </div>


            {/* Department and Assigned To row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label
                        htmlFor="department"
                        className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3 group-focus-within:text-sbi-green transition-colors"
                    >
                        Department
                    </label>
                    <select
                        id="department"
                        name="department"
                        value={formState.department}
                        onChange={handleChange}
                        className="w-full py-3 bg-transparent border-b border-sbi-dark-border focus:border-sbi-green focus:outline-none text-white transition-colors appearance-none cursor-pointer"
                    >
                        {departmentOptions.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                                className="bg-sbi-dark text-white"
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="group">
                    <label
                        htmlFor="assignedTo"
                        className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3 group-focus-within:text-sbi-green transition-colors"
                    >
                        Assign To
                    </label>
                    <select
                        id="assignedTo"
                        name="assignedTo"
                        value={formState.assignedTo}
                        onChange={handleChange}
                        className="w-full py-3 bg-transparent border-b border-sbi-dark-border focus:border-sbi-green focus:outline-none text-white transition-colors appearance-none cursor-pointer"
                    >
                        <option value="" className="bg-sbi-dark text-white">
                            N/A
                        </option>
                        {teamMembers
                            .filter(
                                (member) =>
                                    formState.department === "n/a" ||
                                    member.department === formState.department ||
                                    member.department === "n/a"
                            )
                            .map((member) => (
                                <option
                                    key={member.value}
                                    value={member.value}
                                    className="bg-sbi-dark text-white"
                                >
                                    {member.label}
                                </option>
                            ))}
                    </select>
                </div>
            </div>

            {/* Project */}
            <div className="group">
                <label
                    htmlFor="project"
                    className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3 group-focus-within:text-sbi-green transition-colors"
                >
                    Project
                </label>
                <input
                    type="text"
                    id="project"
                    name="project"
                    value={formState.project}
                    onChange={handleChange}
                    className="w-full py-3 bg-transparent border-b border-sbi-dark-border focus:border-sbi-green focus:outline-none text-white placeholder:text-sbi-muted/40 transition-colors"
                    placeholder="Project name"
                />
            </div>

            {/* Subject */}
            <div className="group">
                <label
                    htmlFor="subject"
                    className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3 group-focus-within:text-sbi-green transition-colors"
                >
                    Subject
                </label>
                <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formState.subject}
                    onChange={handleChange}
                    required
                    className="w-full py-3 bg-transparent border-b border-sbi-dark-border focus:border-sbi-green focus:outline-none text-white placeholder:text-sbi-muted/40 transition-colors"
                    placeholder="Request subject"
                />
            </div>

            {/* Message */}
            <div className="group">
                <label
                    htmlFor="message"
                    className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3 group-focus-within:text-sbi-green transition-colors"
                >
                    Message
                </label>
                <textarea
                    id="message"
                    name="message"
                    value={formState.message}
                    onChange={handleChange}
                    rows={4}
                    className="w-full py-3 bg-transparent border-b border-sbi-dark-border focus:border-sbi-green focus:outline-none text-white placeholder:text-sbi-muted/40 transition-colors resize-none custom-scrollbar"
                    placeholder="Describe your request..."
                />
            </div>

            {/* File Upload */}
            <div>
                <label className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3">
                    Attach Documents
                </label>
                <FileUpload key={resetKey} onFilesChange={setFiles} />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
                <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    className="relative inline-flex items-center gap-3 px-8 py-4 text-sm font-medium tracking-wider uppercase bg-transparent text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                >
                    {isSubmitting ? (
                        <>
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: "linear",
                                }}
                                className="w-4 h-4 border-2 border-sbi-green border-t-transparent rounded-full"
                            />
                            <span>Submitting...</span>
                        </>
                    ) : (
                        <>
                            <span>Submit Request</span>
                            <Send className="w-4 h-4" />
                        </>
                    )}
                </motion.button>
            </div>
        </form>
    );
}
