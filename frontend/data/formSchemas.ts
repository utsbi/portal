export type FormField = {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'email' | 'checkbox' | 'date';
    placeholder?: string;
    required?: boolean;
    description?: string; // For the "Follow-up/Specifics"
};

export type FormSchema = {
    title: string;
    description: string;
    fields: FormField[];
};

export const formSchemas: Record<string, FormSchema> = {
    "General Form": {
        title: "General Project Information",
        description: "Please provide the foundational details for your project.",
        fields: [
            {
                id: "objective",
                label: "What is the primary objective of this project?",
                type: "textarea",
                placeholder: "Describe the core goals...",
                required: true,
                description: "Is it for residential, commercial, or community use? What are the 'must-have' vs. 'nice-to-have' features?"
            },
            {
                id: "impact",
                label: "What level of environmental impact are you aiming for?",
                type: "textarea",
                placeholder: "e.g., LEED Platinum, Net Zero...",
                description: "Are you targeting specific certifications? Do you prioritize water conservation, energy efficiency, or carbon footprint?"
            },
            {
                id: "location",
                label: "Where is the project located?",
                type: "textarea",
                placeholder: "Address or coordinates...",
                required: true,
                description: "What are the dimensions of the lot? Are there existing structures, utilities, or specific topographical challenges?"
            },
            {
                id: "hasPool",
                label: "Do you want to include a pool in this project?",
                type: "checkbox",
                description: "Checking this will generate specialized questionnaires for Engineering and Finance teams."
            },
            {
                id: "infrastructure",
                label: "What other specific infrastructure components are required?",
                type: "textarea",
                placeholder: "HVAC, solar array, greywater recycling...",
                description: "Do you need a HVAC system, solar array, or greywater recycling?"
            },
            {
                id: "budget",
                label: "What is the total projected budget?",
                type: "text",
                placeholder: "$",
                description: "Is there a hard cap on capital expenditures? Are you looking for a ROI analysis on energy-saving technologies?"
            },
            {
                id: "management",
                label: "How will the building be managed or monitored?",
                type: "textarea",
                placeholder: "On-site staff, automated systems...",
                description: "Do you need a custom client portal, IoT sensors for energy tracking, or automated building management systems?"
            },
            {
                id: "timeline",
                label: "What is your desired completion date?",
                type: "text",
                placeholder: "MM/YYYY",
                description: "Are there specific zoning laws, HOA restrictions, or permit deadlines we need to navigate?"
            }
        ]
    },
    "Pool - Civil Engineering": {
        title: "Pool Deep Dive: Civil Engineering",
        description: "Specifics regarding site composition and structural requirements.",
        fields: [
            {
                id: "soil_composition",
                label: "What is the soil composition of the site?",
                type: "textarea",
                placeholder: "Clay, sand, bedrock...",
                required: true,
                description: "Do we need specialized retaining walls to prevent shifting?"
            },
            {
                id: "foundation_reqs",
                label: "Foundation Requirements",
                type: "textarea",
                placeholder: "Describe foundation needs...",
                description: "Any specific load-bearing requirements?"
            }
        ]
    },
    "Pool - Mechanical Systems": {
        title: "Pool Deep Dive: Mechanical & Sustainability",
        description: "Heating, energy integration, and water management.",
        fields: [
            {
                id: "heating",
                label: "How will the pool be heated?",
                type: "textarea",
                placeholder: "Gas, electric, solar...",
                required: true,
                description: "Can we integrate a solar-thermal system to offset energy costs?"
            },
            {
                id: "water_management",
                label: "What is the plan for drainage and water evaporation mitigation?",
                type: "textarea",
                placeholder: "Cover, recycling system...",
                description: "Detailed water management strategy."
            }
        ]
    },
    "Pool - Finance": {
        title: "Pool Deep Dive: Finance",
        description: "Long-term maintenance and cost analysis.",
        fields: [
            {
                id: "maintenance_forecast",
                label: "What is the 10-year maintenance forecast for the filtration systems chosen?",
                type: "textarea",
                placeholder: "Estimated annual costs...",
                required: true,
                description: "Include filter replacement, chemical costs, and pump maintenance."
            }
        ]
    }
};
