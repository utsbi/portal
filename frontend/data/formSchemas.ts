export type FormField = {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'email' | 'checkbox' | 'date' | 'section-header' | 'multi-select' | 'select';
    placeholder?: string;
    required?: boolean;
    description?: string;
    options?: string[]; // For multi-select or select
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
    },
    "Conceptual Basics": {
        title: "Project Concept: Basics",
        description: "Foundational details about the layout and scale of your home.",
        fields: [
            {
                id: "sq_footage",
                label: "Approximate desired total square footage",
                type: "text",
                placeholder: "sq. ft."
            },
            {
                id: "floors",
                label: "Number of floors",
                type: "text",
                placeholder: "e.g., 1, 2, 3"
            },
            {
                id: "total_bedrooms",
                label: "Total number of bedrooms",
                type: "text"
            },
            {
                id: "master_suite",
                label: "Ideal Master Suite Description",
                type: "textarea",
                description: "Special features (e.g., private balcony, sitting room, fireplace, dual closets)?"
            },
            {
                id: "entryway",
                label: "Front Entrance Impression",
                type: "textarea",
                description: "How should it feel? (e.g., Grand, Understated, Welcoming)"
            }
        ]
    },
    "Interior Detail": {
        title: "Project Concept: Interior Programming",
        description: "How you plan to live and entertain within the home.",
        fields: [
            {
                id: "sec_kitchen",
                label: "Kitchen & Dining",
                type: "section-header"
            },
            {
                id: "kitchen_spaces",
                label: "Desired Kitchen & Dining Spaces",
                type: "multi-select",
                options: ["Gourmet Kitchen", "Prep Kitchen/Scullery", "Formal Dining Room", "Breakfast Nook", "Wine Cellar/Room", "Large Island(s)"]
            },
            {
                id: "sec_living",
                label: "Living & Entertaining",
                type: "section-header"
            },
            {
                id: "living_spaces",
                label: "Priority Spaces",
                type: "multi-select",
                options: ["Great Room", "Double-Height Ceiling", "Home Theater/Media Room", "Game Room/Billiards", "Home Bar/Lounge", "Library/Study", "Private Guest Wing"]
            },
            {
                id: "sec_functional",
                label: "Personal Spaces",
                type: "section-header"
            },
            {
                id: "functional_spaces",
                label: "Personal & Functional Requirements",
                type: "multi-select",
                options: ["Home Office(s)", "Home Gym", "Yoga/Massage Room", "Mudroom", "Large Laundry Room", "Safe Room/Panic Room"]
            }
        ]
    },
    "Architecture & Aesthetic": {
        title: "Project Concept: Architecture & Soul",
        description: "The visual language and materials of your dream home.",
        fields: [
            {
                id: "atmosphere",
                label: "Interior Atmosphere Keywords",
                type: "textarea",
                placeholder: "e.g., Modern, Cozy, Industrial, Minimalist..."
            },
            {
                id: "arch_styles",
                label: "Architectural Styles",
                type: "textarea",
                description: "Styles you are drawn to (e.g., Contemporary, Transitional, Mediterranean, Hill Country Modern)"
            },
            {
                id: "exterior_materials",
                label: "Primary Exterior Materials",
                type: "multi-select",
                options: ["Stone", "Stucco", "Brick", "Wood/Siding", "Steel/Metal", "Glass Panels"],
                description: "Check up to two"
            },
            {
                id: "window_style",
                label: "Window & Door Style Preference",
                type: "textarea"
            },
            {
                id: "roofing",
                label: "Roofing Materials",
                type: "text"
            }
        ]
    },
    "The Estate": {
        title: "Project Concept: The Estate & Grounds",
        description: "Everything outside the main living walls.",
        fields: [
            {
                id: "garage_bays",
                label: "Number of garage bays required",
                type: "text"
            },
            {
                id: "garage_style",
                label: "Garage style",
                type: "textarea",
                description: "Attached, Detached, Side-entry, etc."
            },
            {
                id: "indoor_outdoor_flow",
                label: "Indoor-Outdoor Connection Importance",
                type: "textarea"
            },
            {
                id: "outdoor_structures",
                label: "Outdoor Structures",
                type: "multi-select",
                options: ["Outdoor Kitchen", "Pool House/Cabana", "Guest House (Casita)", "Pergola/Gazebo", "Fire Pit/Outdoor Fireplace"]
            },
            {
                id: "sports_rec",
                label: "Sports & Recreation",
                type: "multi-select",
                options: ["Sport Court (Basketball)", "Tennis/Pickleball Court", "Putting Green", "Hiking Trails on Property"]
            },
            {
                id: "landscaping",
                label: "Landscaping Style",
                type: "textarea"
            },
            {
                id: "wantsPool",
                label: "Include a swimming pool in this concept?",
                type: "checkbox",
                description: "Checking this will unlock the Pool Specifications questionnaire."
            }
        ]
    },
    "Pool Specifications": {
        title: "Client Concept: Pool Details",
        description: "Refining the vision for your pool and water features.",
        fields: [
            {
                id: "pool_style",
                label: "Swimming Pool Style Preference",
                type: "textarea",
                placeholder: "Geometric, Freeform, Infinity-edge..."
            },
            {
                id: "pool_extra",
                label: "Extra Pool Features",
                type: "multi-select",
                options: ["Spa/Hot Tub", "Fire pits near pool", "Tanning ledge (Baja shelf)", "Waterfall/Water feature", "LED Lighting"]
            },
            {
                id: "pool_usage",
                label: "Primary Pool Usage",
                type: "textarea",
                description: "Laps, Entertaining, Kids/Family, Aesthetics?"
            }
        ]
    }
};