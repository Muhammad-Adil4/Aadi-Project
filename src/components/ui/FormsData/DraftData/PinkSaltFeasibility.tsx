/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/AxiosCalls";
import { FormConfig } from "@/lib/FormTypes";
import { DynamicForm } from "@/pages/drafts/DynamicForm";
import { usageDataActions } from "@/ReduxStore/Slices/UsageData.slice";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import React, { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

// --- 1. Zod Schema ---
const PinkSaltFeasibilitySchema = z.object({
    // ============================================
    // SECTION 1: PROJECT & SCHEME INFORMATION
    // ============================================
    project_title: z.string({ required_error: "Project Title is required" }).min(1, "Project Title is required"),
    scheme_name: z.string({ required_error: "Scheme Name is required" }).min(1, "Scheme Name is required"),
    bank_name: z.string({ required_error: "Bank Name is required" }).min(1, "Bank Name is required"),
    report_currency: z.string({ required_error: "Report Currency is required" }).default("PKR"),
    fx_usd_to_pkr: z.preprocess(
        (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
        z.number({ required_error: "FX Rate (USD to PKR) is required" }).min(1, "FX Rate must be at least 1")
    ),
    report_horizon_years: z.coerce.number().default(5),
    project_summary: z.string({ required_error: "Project Summary is required" }).min(20, "Summary must be at least 20 chars"),

    exporting_enabled: z.boolean()
        .default(true)
        .refine(val => val === true, {
            message: "Exporting must be enabled for this report"
        }),

    // ============================================
    // SECTION 2: PROMOTER / BUSINESS PROFILE
    // ============================================
    promoter_name: z.string().min(1, "Promoter Name is required"),
    cnic: z.string().min(1, "CNIC is required"),
    phone: z.string().min(1, "Phone is required"),
    email: z.string().optional(),
    business_legal_form: z.enum(['Sole Proprietorship', 'Partnership', 'Company'], { errorMap: () => ({ message: "Legal Form is required" }) }),
    ntn: z.string().optional(),
    strn: z.string().optional(),
    experience_years: z.preprocess(
        (val) => val === "" ? undefined : Number(val),
        z.number({ required_error: "Experience (Years) is required" }).min(0, "Experience must be 0 or greater")
    ),
    relevant_experience_notes: z.string().optional(),
    existing_business: z.boolean().optional(),
    existing_turnover_monthly: z.preprocess(
        (val) => {
            if (val === "" || val === null || val === undefined) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        },
        z.number().optional()
    ),

    // ============================================
    // SECTION 3: LOCATION & PREMISES
    // ============================================
    province: z.string().min(1, "Province is required"),
    district_city: z.string().min(1, "City is required"),
    site_address: z.string().min(1, "Address is required"),
    nearby_salt_source: z.enum(['Khewra', 'Warcha', 'Kalabagh', 'Other'], { errorMap: () => ({ message: "Salt Source is required" }) }),
    distance_to_source_km: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Distance to source is required",
    }).min(0, "Distance required")),
    nearest_dry_port_or_seaport: z.string().min(1, "Nearest Dry Port or Seaport is required"),
    distance_to_port_km: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Distance to port is required",
    }).min(0, "Distance to port required")),

    premises_status: z.enum(['Owned', 'Rented', 'Leased'], { errorMap: () => ({ message: "Premises Status is required" }) }),
    covered_area_sqft: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Covered Area is required",
    }).min(1, "Covered Area required")),
    processing_area_sqft: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Processing Area is required",
    }).min(1, "Processing Area required")),
    warehouse_area_sqft: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Warehouse Area is required",
    }).min(1, "Warehouse Area required")),
    packing_area_sqft: z.preprocess(
        (val) => {
            if (val === "" || val === null || val === undefined) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        },
        z.number().optional()
    ),
    lab_qc_area_sqft: z.preprocess(
        (val) => {
            if (val === "" || val === null || val === undefined) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        },
        z.number().optional()
    ),
    rent_per_month: z.preprocess(
        (val) => {
            if (val === "" || val === null || val === undefined) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        },
        z.number({
            required_error: "Rent is required",
        }).min(0, {
            message: "Rent must be 0 or greater",
        })
    ),

    utilities_available: z.array(z.string()).min(1, "Select at least one utility"),
    power_backup_required: z.boolean().optional(),

    // ============================================
    // SECTION 4: RAW MATERIAL & SUPPLY CHAIN
    // ============================================
    raw_salt_source_type: z.enum(['Direct from Mine', 'Through Supplier/Trader', 'Own Mining Lease'], { errorMap: () => ({ message: "Source Type required" }) }),
    supplier_name: z.string().min(1, "Supplier Name required"),
    source_location: z.string().min(1, "Source Location required"),
    raw_salt_grade: z.enum(['Food-grade suitable', 'Industrial grade (needs refining)', 'Mixed'], {
        errorMap: () => ({ message: "Raw Salt Grade required" })
    }),
    monthly_raw_salt_available_tons: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Monthly raw salt available tons required",
    }).min(1, "Monthly raw salt available tons required")),
    raw_salt_purchase_price_per_kg: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Raw salt purchase price per KG required",
    }).min(0.1, "Raw salt purchase price per KG required")),
    inbound_transport_cost_per_ton: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Inbound transport cost per ton required",
    }).min(0, "Inbound transport cost per ton required")),

    sorting_wastage_percent: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Sorting wastage percent required",
    }).min(0, "Sorting wastage percent required")),
    washing_loss_percent: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Washing loss percent required",
    }).min(0, "Washing loss percent required")),
    grinding_sieving_loss_percent: z.preprocess((val) => val === "" ? undefined : Number(val), z.number({
        required_error: "Grinding sieving loss percent required",
    }).min(0, "Grinding sieving loss percent required")),
    total_process_loss_percent: z.preprocess(
        (val) => {
            if (val === "" || val === null || val === undefined) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        },
        z.number().optional()
    ),

    // ============================================
    // SECTION 5: PRODUCT PORTFOLIO & PRICING
    // ============================================
    products: z.array(z.object({
        sku_name: z.string().optional(),
        product_category: z.preprocess(
            (val) => val === "" ? undefined : val,
            z.enum(['Edible Fine', 'Edible Coarse', 'Bath Salt', 'Salt Chunks', 'Salt Lamp/Decor', 'Industrial']).optional()
        ),
        uom: z.preprocess(
            (val) => val === "" ? undefined : val,
            z.enum(['kg', 'piece', 'pack']).optional()
        ),
        pack_size_g: z.preprocess((val) => val === "" ? undefined : Number(val), z.number().optional()),
        target_market: z.preprocess(
            (val) => val === "" ? undefined : val,
            z.enum(['Domestic', 'Export', 'Both'], {
                errorMap: () => ({ message: "Target Market required" })
            })
        ),
        installed_capacity_per_month: z.preprocess((val) => val === "" ? undefined : Number(val), z.number().optional()),
        year1_capacity_utilization_percent: z.preprocess((val) => val === "" ? undefined : Number(val), z.number().min(0).max(100).optional()),
        year2_capacity_utilization_percent: z.preprocess((val) => val === "" ? undefined : Number(val), z.number().min(0, "Capacity Utilization cannot be less than 0%").max(100, "Capacity Utilization cannot be more than 100%").default(60)).optional(),
        year3_capacity_utilization_percent: z.preprocess((val) => val === "" ? undefined : Number(val), z.number().min(0, "Capacity Utilization cannot be less than 0%").max(100, "Capacity Utilization cannot be more than 100%").default(70)).optional(),

        domestic_selling_price_per_unit: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number({
                required_error: "Domestic Price is required",
            }).optional()
        ),
        export_selling_price_per_unit: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number({
                required_error: "Export Price is required",
            }).optional()
        ),
        export_price_currency: z.preprocess(
            (val) => val === "" ? undefined : val,
            z.enum(['USD', 'EUR', 'GBP']).optional()
        ),
        expected_discount_or_commission_percent: z.preprocess((val) => {
            if (val === "" || val === null || val === undefined) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        },
            z.number().optional()
                .default(0)),

        // Costing Fields
        net_salt_content_per_unit_kg: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number({
                required_error: "Net Salt Content is required"
            }).min(0.001, "Net Salt Content must be greater than 0")
        ),
        packaging_cost_per_unit: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number({
                required_error: "Packaging Cost is required"
            }).min(0, "Packaging Cost must be 0 or greater")
        ),
        direct_labor_cost_per_unit: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number().optional()
        ),
        qc_testing_cost_per_unit: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number().optional()
        ),
        other_variable_cost_per_unit: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number().optional()
        ),

        // BOM Mode
        product_bom: z.array(z.object({
            component_type: z.enum(['Input', 'Packaging']),
            component_name: z.string().min(1),
            consumption_per_unit: z.coerce.number().min(0.0001),
            scrap_percent: z.coerce.number().default(0),
            unit_cost: z.coerce.number().optional()
        })).optional(),

        // Auto Fields
        gross_salt_required_per_unit_kg: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number().optional()
        ),
        raw_salt_cost_per_unit: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number().optional()
        ),
        unit_variable_cost: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number().optional()
        ),
        unit_material_cost: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            },
            z.number().optional()
        ),

        // Results
        gross_units: z.number().optional(),
        good_units: z.number().optional(),
        monthly_revenue_sku: z.number().optional(),
        monthly_cogs_sku: z.number().optional(),

    }).superRefine((item, ctx) => {

        // --- Basic Required Checks (Moved from Base Schema to ensure refinement runs) ---
        if (!item.sku_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SKU Name required", path: ['sku_name'] });
        if (!item.product_category) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Product Category is required", path: ['product_category'] });
        if (!item.uom) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "UOM is required", path: ['uom'] });
        if (!item.target_market) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Target Market is required", path: ['target_market'] });

        // 1. Domestic Price Required
        if (item.target_market && ['Domestic', 'Both'].includes(item.target_market)) {
            // Check for null specifically
            if (item.domestic_selling_price_per_unit === null || item.domestic_selling_price_per_unit === undefined || item.domestic_selling_price_per_unit <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Domestic Price is required",
                    path: ['domestic_selling_price_per_unit']
                });
            }
        }

        // 2. Export Price Required if Target is Export or Both
        if (['Export', 'Both'].includes(item.target_market)) {
            if (item.export_selling_price_per_unit === undefined || item.export_selling_price_per_unit <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Export Price is required",
                    path: ['export_selling_price_per_unit']
                });
            }
        }

        // 3. Circular Dependency: If Export Price is entered (>= 0) -> Currency Required
        if (item.export_selling_price_per_unit !== undefined && item.export_selling_price_per_unit !== null && item.export_selling_price_per_unit >= 0) {
            if (!item.export_price_currency) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Currency is required",
                    path: ['export_price_currency']
                });
            }
        }

        // 4. Circular Dependency: If Currency Selected -> Export Price Required
        if (item.export_price_currency) {
            if (item.export_selling_price_per_unit === undefined || item.export_selling_price_per_unit < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Export Price is required",
                    path: ['export_selling_price_per_unit']
                });
            }
        }
    })).min(1, "At least one product required"),

    // 6. Costing Mode
    costing_mode: z.enum(['Simple', 'Detailed_BOM'], {
        errorMap: () => {
            return { message: "Costing Mode is required" };
        }
    }),

    // Detailed BOM Inputs
    inputs: z.array(z.object({
        input_name: z.string().min(1),
        uom: z.enum(['kg', 'gram', 'liter', 'piece']),
        unit_cost: z.coerce.number().min(0),
        supplier_notes: z.string().optional()
    })).optional(),

    packaging_materials: z.array(z.object({
        material_name: z.string().min(1),
        uom: z.enum(['piece', 'meter', 'kg']),
        unit_cost: z.coerce.number().min(0)
    })).optional(),

    // 7. Processing & Operations Assumptions
    process_flow_overview: z.string({
        required_error: "Process flow overview is required"
    }).min(1, "Process flow overview is required"),
    shifts_per_day: z.preprocess(val => Number(val), z.number({
        required_error: "Shifts per Day is required"
    }).min(1, {
        message: "Shifts per Day must be at least 1"
    }).default(1)),
    working_days_per_month: z.preprocess(val => Number(val), z.number({
        required_error: "Working Days per Month is required"
    }).min(1, {
        message: "Working Days per Month must be at least 1"
    }).default(26)),
    maintenance_days_per_month: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional().default(1)),
    batch_traceability: z.preprocess(
        (val) => val === "" ? undefined : val,
        z.enum(['Manual', 'Batch Codes', 'ERP'], {
            errorMap: (issue) => {
                return {
                    message: "Batch Traceability is required"
                }
            }
        })
    ),
    quality_checks: z.array(z.string()).min(1, "At least one quality check is required"),

    // 8. Regulatory, Certifications & Export Compliance
    food_authority_registration: z.preprocess(
        (val) => val === "" ? undefined : val,
        z.enum(['Not Applied', 'In Process', 'Approved'], {
            errorMap: (issue) => {
                return {
                    message: "Food Authority Registration is required"
                }
            }
        })
    ),
    psqca_applicable: z.boolean().optional().default(false),
    halal_cert_required: z.boolean().optional().default(false),

    // Export Compliance (Conditional)
    export_target_regions: z.array(z.string()).min(1, "At least one export target region is required"),
    hs_code_primary: z.string({
        required_error: "HS Code is required"
    }).min(1, "HS Code is required"),
    labeling_language_requirements: z.string().optional(),
    third_party_inspection_required: z.boolean().optional().default(false),
    certifications: z.array(z.object({
        cert_name: z.enum(['ISO 22000', 'HACCP', 'Organic', 'Other']),
        status: z.enum(['Planned', 'In Process', 'Certified']),
        one_time_cost: z.coerce.number().optional(),
        annual_cost: z.coerce.number().optional()
    })).optional().default([]),
    export_docs_needed: z.array(z.string()).optional().default([]),

    // 9. Export Logistics & Order Assumptions
    export_mode: z.enum(['Sea', 'Air', 'Road', 'Rail'], { errorMap: () => ({ message: "Export Mode is required" }) }),
    incoterm: z.enum(['EXW', 'FOB', 'CIF', 'DAP'], { errorMap: () => ({ message: "Incoterm is required" }) }),
    shipment_frequency_per_month: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().optional()),
    avg_export_order_size_kg: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number({ required_error: "Average Export Order Size is required" }).min(1)),
    port_of_loading: z.string({ required_error: "Port of Loading is required" }).min(1, "Port of Loading is required"),
    freight_cost_per_kg_or_container: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number({ required_error: "Freight Cost is required" }).min(0)),
    insurance_cost_monthly: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().optional().default(0)),
    clearing_forwarding_cost_per_shipment: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().optional().default(0)),
    export_payment_term: z.enum(['Advance', 'LC', 'Documents against Payment', 'Net-30/60'], { errorMap: () => ({ message: "Payment Term is required" }) }).optional(),
    expected_export_receivables_days: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number({
        required_error: "Receivables Days is required"
    }).min(1, {
        message: "Receivables Days must be 1 or greater"
    })),
    monthly_export_logistics_cost: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().optional()),

    // 10. Capex
    // 10. Capex (Infrastructure & Machinery)
    capex_items: z.array(z.object({
        item_name: z.string({ required_error: "Item Name is required" }).min(1, "Item Name is required"),
        category: z.enum(['Building/Renovation', 'Machinery', 'Utilities Setup', 'Lab/QC', 'Forklift/Handling', 'IT/ERP', 'Vehicle', 'Furniture', 'Pre-Op'], { errorMap: () => ({ message: "Category is required" }) }),
        quantity: z.coerce.number({ required_error: "Quantity is required" }).min(1, "Quantity must be at least 1"),
        rate_per_unit: z.preprocess((val) => {
            if (val === "" || val === null || val === undefined) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        }, z.number({ required_error: "Rate is required" }).min(0, "Rate must be 0 or greater")),
        total_cost: z.coerce.number().optional(),
        remarks: z.string().optional()
    })).min(1, "At least one Capex item is required"),
    preoperating_cost_lump_sum: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number({ required_error: "Pre-operating Cost is required" }).min(0)),
    contingency_percent: z.coerce.number().optional().default(5),
    capex_subtotal: z.coerce.number().optional(),
    contingency_amount: z.coerce.number().optional(),
    total_capex: z.coerce.number().optional(),

    // 11. HR
    // 11. HR & Payroll
    staff: z.array(z.object({
        role: z.string({ required_error: "Role is required" }).min(1, "Role is required"),
        count: z.preprocess(val => val === "" ? undefined : Number(val), z.number({ required_error: "Count is required" }).min(1, "Count must be at least 1")),
        monthly_salary_per_person: z.preprocess(val => val === "" ? undefined : Number(val), z.number({ required_error: "Salary is required" }).min(0)),
        is_direct_labor: z.boolean().optional().default(false)
    })).min(1, "At least one staff member is required"),
    monthly_payroll_total: z.coerce.number().optional(),
    monthly_direct_labor_total: z.coerce.number().optional(),
    monthly_indirect_labor_total: z.coerce.number().optional(),

    // 12. OPEX
    electricity_cost_monthly: z.coerce.number({ required_error: "Electricity Cost is required" }).min(0),
    water_cost_monthly: z.coerce.number().optional(),
    fuel_transport_monthly: z.coerce.number().optional(),
    maintenance_cost_monthly: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number({ required_error: "Maintenance Cost is required" }).min(0, {
        message: "Maintenance Cost is required"
    })),
    rent_monthly: z.coerce.number().optional(),
    admin_expenses_monthly: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number({ required_error: "Admin Expenses is required" }).min(0, {
        message: "Admin Expenses is required"
    })),
    sales_marketing_monthly: z.preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number({ required_error: "Sales & Marketing is required" }).min(0, {
        message: "Sales & Marketing is required"
    })),
    qc_lab_consumables_monthly: z.coerce.number().optional(),
    export_marketing_cost_monthly: z.coerce.number().optional(),
    misc_monthly: z.coerce.number().optional(),
    monthly_overheads_total: z.coerce.number().optional(),

    // 13. Revenue & COGS Autos
    // 13. Revenue & COGS Autos
    monthly_revenue_total: z.coerce.number().optional(),
    monthly_cogs_total: z.coerce.number().optional(),
    monthly_gross_profit: z.coerce.number().optional(),
    monthly_net_profit_before_finance: z.coerce.number().optional(),

    // 14. Working Capital
    raw_material_inventory_days: z.coerce.number().default(30),
    packaging_inventory_days: z.coerce.number().default(30),
    finished_goods_inventory_days: z.coerce.number().default(15),
    domestic_receivables_days: z.coerce.number().default(30),
    export_receivables_days: z.coerce.number().default(45),
    payables_days: z.coerce.number().default(15),
    cash_buffer_days: z.coerce.number().default(10),

    working_capital_required: z.coerce.number().optional(),
    daily_cogs: z.coerce.number().optional(),
    daily_sales: z.coerce.number().optional(),
    inventory_investment: z.coerce.number().optional(),
    receivables_investment: z.coerce.number().optional(),
    payables_credit: z.coerce.number().optional(),
    cash_buffer: z.number().optional(),

    // 15. Financing
    loan_amount_requested: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
        z.number({ required_error: "Loan Amount is required" }).min(1)
    ),

    owner_equity_contribution: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
        z.number({ required_error: "Owner Equity is required" }).min(0)
    ),

    markup_rate_percent: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
        z.number({ required_error: "Markup Rate is required" }).min(0)
    ),

    // FIX: Removed .default(0) to force user input
    grace_period_months: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
        z.number({ required_error: "Grace Period is required" })
            .min(0, "Cannot be negative")
    ),

    tenor_years: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
        z.number({ required_error: "Tenor is required" }).min(1)
    ),

    installment_type: z.enum(['EMI', 'Equal Principal', 'Custom'], {
        errorMap: () => ({ message: "Installment Type is required" })
    }).default('EMI'),

    // Read-only fields
    num_installments: z.coerce.number().optional(),
    installment_amount: z.coerce.number().optional(),
    total_tenor_months: z.coerce.number().optional(),
    // 16. Risks
    risks: z.array(z.object({
        risk_title: z.string({
            required_error: "Risk Title is required"
        }).min(1, {
            message: "Risk Title is required"
        }),
        impact_description: z.string({
            required_error: "Impact Description is required"
        }).min(1, {
            message: "Impact Description is required"
        }),
        mitigation_strategy: z.string({
            required_error: "Mitigation Strategy is required"
        }).min(1, {
            message: "Mitigation Strategy is required"
        }),
        severity_level: z.enum(['Low', 'Medium', 'High']).optional()
    })),

    // 17. ESG
    dust_control_measures: z.string().optional(),
    worker_safety_measures: z.string().optional(),
    waste_management_plan: z.string().optional(),
    sustainability_notes: z.string().optional(),

    // 18. Conclusion
    project_objectives_custom: z.string().optional(),
    conclusion_custom_notes: z.string().optional(),

}).superRefine((data, ctx) => {
    // 1. Export Logic Validation
    if (data.exporting_enabled) {
        if (!data.fx_usd_to_pkr || data.fx_usd_to_pkr <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fx_usd_to_pkr"], message: "FX Rate required for Export" });
        }
        if (!data.export_mode) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["export_mode"], message: "Export Mode required" });
        }

        // Validation for Target Regions and HS Code
        if (!data.export_target_regions || data.export_target_regions.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["export_target_regions"], message: "Select at least 1 checkbox" });
        }
        if (!data.hs_code_primary || data.hs_code_primary.trim() === '') {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hs_code_primary"], message: "Primary HS Code is required" });
        }

        // Section 9: Export Logistics Validations
        if (!data.incoterm) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["incoterm"], message: "Incoterm is required" });
        }
        if (!data.avg_export_order_size_kg || data.avg_export_order_size_kg <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["avg_export_order_size_kg"], message: "Avg Export Order Size is required" });
        }
        if (!data.port_of_loading || data.port_of_loading.trim() === '') {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["port_of_loading"], message: "Port of Loading is required" });
        }
        if (data.freight_cost_per_kg_or_container === undefined || data.freight_cost_per_kg_or_container < 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["freight_cost_per_kg_or_container"], message: "Freight Cost is required" });
        }
        if (!data.export_payment_term) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["export_payment_term"], message: "Export Payment Term is required" });
        }
        if (data.expected_export_receivables_days === undefined || data.expected_export_receivables_days < 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expected_export_receivables_days"], message: "Receivables Days is required" });
        }
    }
    // 2. Rent Condition - Only required for Rented or Leased
    if (data.premises_status === 'Rented' || data.premises_status === 'Leased') {
        if (!data.rent_per_month || data.rent_per_month <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["rent_per_month"],
                message: "Rent Per Month is required when premises are Rented or Leased"
            });
        }
    }
});

// --- 2. Form Layout Configuration ---
const pinkSaltFormConfig: FormConfig = {
    title: "Pink Salt Processing Feasibility",
    description: "Bank-ready feasibility report for Pink Salt Processing & Export.",
    apiEndpoint: "/generate-pink-salt-feasibility",
    draftTypeId: "45",
    schema: PinkSaltFeasibilitySchema,
    defaultValues: {
        // --- 1. Project Info ---
        project_title: '', scheme_name: '', bank_name: '', report_currency: 'PKR', fx_usd_to_pkr: '', project_summary: '', report_horizon_years: "5", exporting_enabled: true,

        // --- 2. Promoter Info ---
        promoter_name: '', cnic: '', phone: '', email: '', business_legal_form: '', ntn: '', strn: '',
        experience_years: '', relevant_experience_notes: '', existing_business: false, existing_turnover_monthly: '',

        // --- 3. Location ---
        province: '', district_city: '', site_address: '', nearby_salt_source: '', distance_to_source_km: '',
        nearest_dry_port_or_seaport: '', distance_to_port_km: '', premises_status: '', covered_area_sqft: '',
        processing_area_sqft: '', warehouse_area_sqft: '', packing_area_sqft: '', lab_qc_area_sqft: '',
        rent_per_month: '', utilities_available: [], power_backup_required: false,

        // --- 4. Supply Chain ---
        raw_salt_source_type: '', supplier_name: '', source_location: '', raw_salt_grade: '',
        monthly_raw_salt_available_tons: '', raw_salt_purchase_price_per_kg: '', inbound_transport_cost_per_ton: '',
        sorting_wastage_percent: 2, washing_loss_percent: 1, grinding_sieving_loss_percent: 0.5, total_process_loss_percent: '',

        // --- 5. Products ---
        products: [{
            sku_name: '', product_category: '', uom: '', pack_size_g: '', target_market: '',
            installed_capacity_per_month: '', year1_capacity_utilization_percent: 50, year2_capacity_utilization_percent: 60, year3_capacity_utilization_percent: 70,
            domestic_selling_price_per_unit: '', export_selling_price_per_unit: '', export_price_currency: '',
            expected_discount_or_commission_percent: 0,
            net_salt_content_per_unit_kg: '', packaging_cost_per_unit: '', direct_labor_cost_per_unit: '',
            qc_testing_cost_per_unit: 0, other_variable_cost_per_unit: 0
        }],

        // --- 9. Export Logistics ---
        export_enabled: true,
        export_mode: '', incoterm: '', shipment_frequency_per_month: '', avg_export_order_size_kg: '', port_of_loading: '',
        freight_cost_per_kg_or_container: '', insurance_cost_monthly: '0', clearing_forwarding_cost_per_shipment: '0', export_payment_term: '', expected_export_receivables_days: '45',
        monthly_export_logistics_cost: '',

        // --- 6. Costing Mode ---
        costing_mode: '', inputs: [], packaging_materials: [],

        // --- 7. Operations ---
        process_flow_overview: '', shifts_per_day: 1, working_days_per_month: 26, maintenance_days_per_month: 1, batch_traceability: '', quality_checks: [],

        // --- 8. Compliance ---
        food_authority_registration: '', psqca_applicable: false, halal_cert_required: false,
        export_target_regions: [], hs_code_primary: '', labeling_language_requirements: '', third_party_inspection_required: false,
        certifications: [], export_docs_needed: [],

        // --- 10. Capex ---
        capex_items: [{ item_name: '', category: '', quantity: "", rate_per_unit: "" }],
        contingency_percent: 5,

        // --- 11. HR ---
        staff: [{ role: '', count: 1, monthly_salary_per_person: "" }],

        // --- 12. OPEX ---
        electricity_cost_monthly: '', maintenance_cost_monthly: '', admin_expenses_monthly: '', sales_marketing_monthly: '',

        // --- 14. Working Capital ---
        raw_material_inventory_days: "30",
        packaging_inventory_days: "30",
        finished_goods_inventory_days: "15",
        domestic_receivables_days: "30",
        export_receivables_days: "45",
        payables_days: "15",
        cash_buffer_days: "10",

        // --- 14. Financing ---
        loan_amount_requested: '',
        owner_equity_contribution: '',
        markup_rate_percent: '0',
        grace_period_months: 0,
        tenor_years: 5,
        num_installments: '',
        installment_type: 'EMI',
        installment_amount: '',
        total_tenor_months: '',

        // --- 16. Risks ---
        risks: [{ risk_title: '', impact_description: '', mitigation_strategy: '' }],

        // --- 17. ESG ---
        dust_control_measures: '', worker_safety_measures: '', waste_management_plan: '', sustainability_notes: '',

        // --- 18. Conclusion ---
        project_objectives_custom: '', conclusion_custom_notes: ''
    },
    sampleData: {
        // ============================================
        // SECTION 1: PROJECT & SCHEME INFORMATION
        // ============================================
        project_title: 'Himalayan Pink Salt Export Expansion',
        scheme_name: 'SME Modernization Fund',
        bank_name: 'Meezan Bank',
        report_currency: 'PKR',
        fx_usd_to_pkr: 278.50,
        report_horizon_years: 5,
        project_summary: 'Establishment of a modern salt processing unit aimed at exporting high-quality edible pink salt to European and North American markets. The facility will have a processing capacity of 500 tons per month.',
        exporting_enabled: true,

        // ============================================
        // SECTION 2: PROMOTER / BUSINESS PROFILE
        // ============================================
        promoter_name: 'Muhammad Ali Raza',
        cnic: '35202-9876543-1',
        phone: '0300-5551234',
        email: 'ali.raza@saltventures.com',
        business_legal_form: 'Sole Proprietorship',
        ntn: '7654321-9',
        strn: '32-77-8761-123-55',
        experience_years: 12,
        relevant_experience_notes: '12 years of experience in commodities trading and 5 years specifically in salt mining and logistics.',
        existing_business: true,
        existing_turnover_monthly: 4500000,

        // ============================================
        // SECTION 3: LOCATION & PREMISES
        // ============================================
        province: 'Punjab',
        district_city: 'Lahore',
        site_address: 'Plot 45-B, Sundar Industrial Estate, Lahore',
        nearby_salt_source: 'Khewra',
        distance_to_source_km: 185,
        nearest_dry_port_or_seaport: 'Lahore Dry Port (Prem Nagar)',
        distance_to_port_km: 35,
        premises_status: 'Rented',
        covered_area_sqft: 8000,
        processing_area_sqft: 5000,
        warehouse_area_sqft: 2000,
        packing_area_sqft: 800,
        lab_qc_area_sqft: 200,
        rent_per_month: 250000,
        // rent_monthly: 0, // Auto-calculated from rent_per_month
        utilities_available: ['Electricity', 'Water', 'Internet'],
        power_backup_required: true,

        // ============================================
        // SECTION 4: RAW MATERIAL & SUPPLY CHAIN
        // ============================================
        raw_salt_source_type: 'Direct from Mine',
        supplier_name: 'Khewra Salt Miners Coop',
        source_location: 'Khewra, Jhelum',
        raw_salt_grade: 'Food-grade suitable',
        monthly_raw_salt_available_tons: 600,
        raw_salt_purchase_price_per_kg: 8.5,
        inbound_transport_cost_per_ton: 2500,
        sorting_wastage_percent: 3,
        washing_loss_percent: 2,
        grinding_sieving_loss_percent: 1.5,
        total_process_loss_percent: 0, // Auto-calculated (Sum of above)

        // ============================================
        // SECTION 5: PRODUCT PORTFOLIO & PRICING
        // ============================================
        costing_mode: 'Simple',
        products: [
            {
                sku_name: 'Edible Pink Salt Fine (1kg Pouch)',
                product_category: 'Edible Fine',
                uom: 'pack',
                pack_size_g: 1000,
                target_market: 'Export',
                installed_capacity_per_month: 100000,
                year1_capacity_utilization_percent: 50,
                year2_capacity_utilization_percent: 65,
                year3_capacity_utilization_percent: 80,
                domestic_selling_price_per_unit: 150,
                export_selling_price_per_unit: 1.85,
                export_price_currency: 'USD',
                expected_discount_or_commission_percent: 2,
                net_salt_content_per_unit_kg: 1,
                packaging_cost_per_unit: 45,
                direct_labor_cost_per_unit: 12,
                qc_testing_cost_per_unit: 3,
                other_variable_cost_per_unit: 5,

                // Auto-Calculated Fields set to 0
                gross_salt_required_per_unit_kg: 0,
                raw_salt_cost_per_unit: 0,
                unit_variable_cost: 0,
                gross_units: 0,
                good_units: 0,
                monthly_revenue_sku: 0,
                monthly_cogs_sku: 0
            },
            {
                sku_name: 'Pink Salt Coarse Grinder (200g)',
                product_category: 'Edible Coarse',
                uom: 'pack',
                pack_size_g: 200,
                target_market: 'Domestic',
                installed_capacity_per_month: 50000,
                year1_capacity_utilization_percent: 40,
                year2_capacity_utilization_percent: 50,
                year3_capacity_utilization_percent: 60,
                domestic_selling_price_per_unit: 350,
                export_selling_price_per_unit: '',
                export_price_currency: '',
                expected_discount_or_commission_percent: 10,
                net_salt_content_per_unit_kg: 0.2,
                packaging_cost_per_unit: 120,
                direct_labor_cost_per_unit: 15,
                qc_testing_cost_per_unit: 2,
                other_variable_cost_per_unit: 5,

                // Auto-Calculated Fields set to 0
                gross_salt_required_per_unit_kg: 0,
                raw_salt_cost_per_unit: 0,
                unit_variable_cost: 0,
                gross_units: 0,
                good_units: 0,
                monthly_revenue_sku: 0,
                monthly_cogs_sku: 0
            }
        ],

        inputs: [
            { input_name: 'Raw Pink Salt Rock', uom: 'kg', unit_cost: 11 }
        ],
        packaging_materials: [
            { material_name: 'Standup Pouch 1kg', uom: 'piece', unit_cost: 45 },
            { material_name: 'Corrugated Master Carton', uom: 'piece', unit_cost: 150 }
        ],

        // ============================================
        // SECTION 6: PROCESSING & OPERATIONS ASSUMPTIONS
        // ============================================
        process_flow_overview: 'Raw Stone Sorting -> Washing (Brine) -> Drying -> Crushing -> Grinding -> Sieving (Mesh Classification) -> Optical Sorting -> Packing -> Metal Detection -> Palletizing',
        shifts_per_day: 2,
        working_days_per_month: 26,
        maintenance_days_per_month: 2,
        batch_traceability: 'Batch Codes',
        quality_checks: ['Moisture', 'NaCl%', 'Foreign matter', 'Packaging integrity', 'Particle size'],

        // ============================================
        // SECTION 7: REGULATORY, CERTIFICATIONS & COMPLIANCE
        // ============================================
        food_authority_registration: 'In Process',
        psqca_applicable: true,
        halal_cert_required: true,
        export_target_regions: ['USA', 'UK/EU'],
        hs_code_primary: '2501.0010',
        labeling_language_requirements: 'English, French (for Canada), German (for EU)',
        third_party_inspection_required: true,
        certifications: [
            { cert_name: 'ISO 22000', status: 'Planned', one_time_cost: 350000, annual_cost: 50000 },
            { cert_name: 'HACCP', status: 'Certified', one_time_cost: 150000, annual_cost: 25000 },
            { cert_name: 'Organic', status: 'In Process', one_time_cost: 500000, annual_cost: 100000 }
        ],
        export_docs_needed: ['Commercial Invoice', 'Packing List', 'Certificate of Origin', 'GD (WeBOC)', 'Inspection cert'],

        // ============================================
        // SECTION 8: EXPORT LOGISTICS & ORDER ASSUMPTIONS
        // ============================================
        export_mode: 'Sea',
        incoterm: 'FOB',
        shipment_frequency_per_month: 4,
        avg_export_order_size_kg: 24000,
        port_of_loading: 'Karachi Port / Port Qasim',
        freight_cost_per_kg_or_container: 450000,
        insurance_cost_monthly: 25000,
        clearing_forwarding_cost_per_shipment: 35000,
        export_payment_term: 'LC',
        expected_export_receivables_days: 60,
        monthly_export_logistics_cost: 0, // Auto-calculated

        // ============================================
        // SECTION 9: CAPEX
        // ============================================
        capex_items: [
            { item_name: 'Salt Washing & Crushing Line', category: 'Machinery', quantity: 1, rate_per_unit: 6500000, total_cost: 0 }, // total_cost auto-calc
            { item_name: 'Optical Color Sorter', category: 'Machinery', quantity: 1, rate_per_unit: 2500000, total_cost: 0 },
            { item_name: 'Plant Civil Works & Renovation', category: 'Building/Renovation', quantity: 1, rate_per_unit: 2000000, total_cost: 0 },
            { item_name: 'Laboratory Equipment (Spectrometer etc)', category: 'Lab/QC', quantity: 1, rate_per_unit: 800000, total_cost: 0 },
            { item_name: 'Forklift 3-Ton', category: 'Forklift/Handling', quantity: 1, rate_per_unit: 3500000, total_cost: 0 }
        ],
        contingency_percent: 5,
        preoperating_cost_lump_sum: 500000,
        capex_subtotal: 0, // Auto-calculated
        contingency_amount: 0, // Auto-calculated
        total_capex: 0, // Auto-calculated

        // ============================================
        // SECTION 10: HR & PAYROLL
        // ============================================
        staff: [
            { role: 'Plant Manager', count: 1, monthly_salary_per_person: 150000, is_direct_labor: false },
            { role: 'Production Supervisor', count: 2, monthly_salary_per_person: 75000, is_direct_labor: true },
            { role: 'Machine Operators', count: 4, monthly_salary_per_person: 45000, is_direct_labor: true },
            { role: 'Helpers / Packers', count: 10, monthly_salary_per_person: 32000, is_direct_labor: true },
            { role: 'QC Analyst', count: 1, monthly_salary_per_person: 60000, is_direct_labor: false },
            { role: 'Accountant', count: 1, monthly_salary_per_person: 55000, is_direct_labor: false }
        ],
        monthly_payroll_total: 0, // Auto-calculated
        monthly_direct_labor_total: 0, // Auto-calculated
        monthly_indirect_labor_total: 0, // Auto-calculated

        // ============================================
        // SECTION 11: OPEX (MONTHLY OVERHEADS)
        // ============================================
        electricity_cost_monthly: 350000,
        water_cost_monthly: 25000,
        fuel_transport_monthly: 50000,
        maintenance_cost_monthly: 40000,
        rent_monthly: 0, // Auto-calculated (will fetch from Rent Per Month if Rented)
        admin_expenses_monthly: 60000,
        sales_marketing_monthly: 150000,
        qc_lab_consumables_monthly: 15000,
        export_marketing_cost_monthly: 200000,
        misc_monthly: 20000,
        monthly_overheads_total: 0, // Auto-calculated

        // ============================================
        // SECTION 12: REVENUE & COGS (AUTO FIELDS)
        // ============================================
        monthly_revenue_total: 0, // Auto-calculated
        monthly_cogs_total: 0, // Auto-calculated
        monthly_gross_profit: 0, // Auto-calculated
        monthly_net_profit_before_finance: 0, // Auto-calculated

        // ============================================
        // SECTION 13: WORKING CAPITAL
        // ============================================
        raw_material_inventory_days: 45,
        packaging_inventory_days: 60,
        finished_goods_inventory_days: 15,
        domestic_receivables_days: 30,
        export_receivables_days: 60,
        payables_days: 20,
        cash_buffer_days: 15,

        // Auto-calculated fields
        working_capital_required: 0,
        inventory_investment: 0,
        receivables_investment: 0,
        payables_credit: 0,
        cash_buffer: 0,

        // ============================================
        // SECTION 14: FINANCING
        // ============================================
        loan_amount_requested: '3000000',
        owner_equity_contribution: '3000000',
        markup_rate_percent: '0',
        grace_period_months: 6,
        tenor_years: 5,

        // --- AUTO-CALCULATED (Left Empty) ---
        num_installments: '',
        installment_type: 'EMI',
        installment_amount: '',
        total_tenor_months: '',

        // ============================================
        // SECTION 15: RISKS
        // ============================================
        risks: [
            {
                risk_title: 'Exchange Rate Volatility',
                impact_description: 'Significant depreciation of PKR increases cost of imported packaging and freight, but benefits export revenue. Appreciation hurts revenue.',
                mitigation_strategy: 'Maintain FCY account for retention of export proceeds to hedge against import payments.',
                severity_level: 'High'
            },
            {
                risk_title: 'Shipping Freight Hikes',
                impact_description: 'Global logistics disruptions can double container costs, eating into margins.',
                mitigation_strategy: 'Sell FOB where possible to transfer freight risk to buyer, or sign annual contracts with shipping lines.',
                severity_level: 'Medium'
            }
        ],

        // ============================================
        // SECTION 16: ESG
        // ============================================
        dust_control_measures: 'Industrial cyclone dust collectors installed at crushing points. Workers provided with N95 masks.',
        worker_safety_measures: 'Mandatory PPE policy. Emergency stop buttons on all conveyors. First aid training for supervisors.',
        waste_management_plan: 'Salt dust collected is sold to leather tanneries (low grade). Plastic waste recycled.',
        sustainability_notes: 'Plan to install 50kW Solar system in Year 2 to reduce carbon footprint.',

        // ============================================
        // SECTION 17: CONCLUSION
        // ============================================
        project_objectives_custom: 'To achieve $1M in annual export revenue by Year 3 and establish a brand recognized for purity in the EU market.',
        conclusion_custom_notes: 'The project is technically feasible given the promoter experience and location advantage. Financial viability is strong with a DSCR > 1.5.'
    },// --- 3. Form Layout Steps ---
    layout: [
        {
            title: "1. Project & Scheme Information", columns: 2,
            fields: [
                { type: 'text', name: 'project_title', label: 'Project Title', isComp: true, placeholder: 'Pink Salt Processing Unit' },
                { type: 'text', name: 'scheme_name', label: 'Scheme Name', isComp: true, placeholder: "“PSIC / SME / Bank Scheme Name" },
                { type: 'text', name: 'bank_name', label: 'Bank Name', isComp: true, placeholder: "Bank Name" },
                { type: 'select', name: 'report_currency', label: 'Report Currency', isComp: true, options: [{ label: 'PKR', value: 'PKR' }] },
                { type: 'select', name: 'report_horizon_years', label: 'Report Horizon (Years)', placeholder: "Select Years", isComp: true, options: [{ label: '5 Years', value: '5' }] },
                { type: 'textarea', name: 'project_summary', label: 'Project Summary', isComp: true, parentStyles: 'sm:col-span-2', placeholder: "Project Summary" },
                { type: 'checkbox', name: 'exporting_enabled', label: 'Exporting Enabled?', isComp: true, parentStyles: 'sm:mt-5' },
                { type: 'number', name: 'fx_usd_to_pkr', label: 'FX Rate (USD to PKR)', placeholder: "e.g., 285", isComp: true, condition: { field: 'exporting_enabled', value: true } },

            ]
        },
        {
            title: "2. Promoter / Business Profile", columns: 2,
            fields: [
                { type: 'text', name: 'promoter_name', label: 'Promoter Name', isComp: true, placeholder: "e.g., Ahmed Khan" },
                { type: 'text', name: 'cnic', label: 'CNIC', isComp: true, placeholder: "e.g., 35202-1234567-1" },
                { type: 'text', name: 'phone', label: 'Phone', isComp: true, placeholder: "e.g., 0300-1234567" },
                { type: 'text', name: 'email', label: 'Email', isComp: false, placeholder: "e.g., abc@gmail.com" },
                { type: 'select', name: 'business_legal_form', label: 'Business Legal Form', placeholder: "Select Legal Form", isComp: true, options: [{ label: 'Sole Proprietorship', value: 'Sole Proprietorship' }, { label: 'Partnership', value: 'Partnership' }, { label: 'Company', value: 'Company' }] },
                { type: 'text', name: 'ntn', label: 'NTN', isComp: false, placeholder: "e.g., 123456789" },
                { type: 'text', name: 'strn', label: 'STRN', isComp: false, placeholder: "e.g., 123456789" },
                { type: 'number', name: 'experience_years', label: 'Experience (Years)', isComp: true, placeholder: "e.g., 10" },
                { type: 'textarea', name: 'relevant_experience_notes', label: 'Relevant Experience Notes', isComp: false, parentStyles: 'sm:col-span-2', placeholder: "mining/sourcing, processing, export, FMCG…" },
                { type: 'checkbox', name: 'existing_business', label: 'Existing Business?', isComp: false },
                {
                    type: 'number', name: 'existing_turnover_monthly', label: 'Existing Business Turnover Monthly', isComp: false, placeholder: "e.g., 100000",
                    condition: { field: 'existing_business', value: true }
                }
            ]
        },
        {
            title: "3. Location & Premises", columns: 2,
            fields: [
                { type: 'text', name: 'province', label: 'Province', isComp: true, placeholder: "e.g., Punjab" },
                { type: 'text', name: 'district_city', label: 'City', isComp: true, placeholder: "e.g., Lahore" },
                { type: 'textarea', name: 'site_address', label: 'Site Address', isComp: true, parentStyles: 'sm:col-span-2', placeholder: "e.g., 123 Main Street, Lahore" },
                { type: 'select', name: 'nearby_salt_source', label: 'Nearby Salt Source', placeholder: "Select Salt Source", isComp: true, options: [{ label: 'Khewra', value: 'Khewra' }, { label: 'Warcha', value: 'Warcha' }, { label: 'Kalabagh', value: 'Kalabagh' }, { label: 'Other', value: 'Other' }] },
                { type: 'number', name: 'distance_to_source_km', label: 'Distance to Source (KM)', isComp: true, placeholder: "e.g., 10" },
                { type: 'text', name: 'nearest_dry_port_or_seaport', label: 'Nearest Dry Port or Seaport', isComp: true, placeholder: "e.g., Karachi Port" },
                { type: 'number', name: 'distance_to_port_km', label: 'Distance to Port (KM)', isComp: true, placeholder: "e.g., 10" },
                { type: 'select', name: 'premises_status', label: 'Premises Status', placeholder: "Select Premises Status", isComp: true, options: [{ label: 'Owned', value: 'Owned' }, { label: 'Rented', value: 'Rented' }, { label: 'Leased', value: 'Leased' }] },
                { type: 'number', name: 'rent_per_month', label: 'Rent Per Month', isComp: true, condition: { field: 'premises_status', value: 'Rented' }, placeholder: "e.g., 10000" },
                { type: 'number', name: 'covered_area_sqft', label: 'Covered Area (sqft)', isComp: true, placeholder: "e.g., 10000" },
                { type: 'number', name: 'processing_area_sqft', label: 'Processing Area (sqft)', isComp: true, placeholder: "e.g., 10000" },
                { type: 'number', name: 'warehouse_area_sqft', label: 'Warehouse Area (sqft)', isComp: true, placeholder: "e.g., 10000" },
                { type: 'number', name: 'packing_area_sqft', label: 'Packing Area (sqft)', isComp: false, placeholder: "e.g., 10000" },
                { type: 'number', name: 'lab_qc_area_sqft', label: 'Lab/QC Area (sqft)', isComp: false, placeholder: "e.g., 10000" },
                { type: 'checkboxGroup', name: 'utilities_available', label: 'Utilities', isComp: true, options: [{ label: 'Electricity', value: 'Electricity' }, { label: 'Water', value: 'Water' }, { label: 'Gas', value: 'Gas' }, { label: 'Internet', value: 'Internet' }] },
                { type: 'checkbox', name: 'power_backup_required', label: 'Power Backup Required', isComp: false, parentStyles: 'sm:mt-3' },
            ]
        },
        {
            title: "4. Raw Material & Supply Chain", columns: 2,
            fields: [
                { type: 'select', name: 'raw_salt_source_type', label: 'Raw Salt Source Type', placeholder: "Select Source Type", isComp: true, options: [{ label: 'Direct from Mine', value: 'Direct from Mine' }, { label: 'Through Supplier/Trader', value: 'Through Supplier/Trader' }, { label: 'Own Mining Lease', value: 'Own Mining Lease' }] },
                { type: 'text', name: 'supplier_name', label: 'Supplier Name', placeholder: "Supplier / Mine Operator", isComp: true },
                { type: 'text', name: 'source_location', label: 'Source Location', placeholder: "e.g., Lahore", isComp: true },
                { type: 'select', name: 'raw_salt_grade', label: 'Raw Salt Grade', placeholder: "Select Grade", isComp: true, options: [{ label: 'Food-grade suitable', value: 'Food-grade suitable' }, { label: 'Industrial grade (needs refining)', value: 'Industrial grade (needs refining)' }, { label: 'Mixed', value: 'Mixed' }] },
                { type: 'number', name: 'monthly_raw_salt_available_tons', label: 'Monthly Raw Salt Available (Tons)', placeholder: "e.g., 100", isComp: true },
                { type: 'number', name: 'raw_salt_purchase_price_per_kg', label: 'Raw Salt Purchase Price per KG (PKR)', placeholder: "e.g., 100", isComp: true },
                { type: 'number', name: 'inbound_transport_cost_per_ton', label: 'Inbound Transport Cost per Ton (PKR)', placeholder: "e.g., Source → Factory", isComp: true },
                { type: 'Title', label: "Material Loss / Yield" },
                { type: 'number', name: 'sorting_wastage_percent', label: 'Sorting Wastage %', placeholder: "e.g., 2", isComp: true },
                { type: 'number', name: 'washing_loss_percent', label: 'Washing Loss %', placeholder: "e.g., 1", isComp: true },
                { type: 'number', name: 'grinding_sieving_loss_percent', label: 'Grinding Sieving Loss %', placeholder: "e.g., 0.5", isComp: true },
                { type: 'number', name: 'total_process_loss_percent', label: 'Total Process Loss %', disabled: true, placeholder: '0' }
            ]
        },
        {
            title: "5. Product Portfolio & Pricing",
            columns: 2,
            fields: [
                // ==========================================
                // 1. GLOBAL SETTINGS (Outside Product Array)
                // ==========================================
                {
                    type: 'select',
                    name: 'costing_mode',
                    parentStyles: "sm:col-span-2",
                    placeholder: 'Select Costing Mode',
                    label: 'Costing Mode',
                    isComp: true,
                    options: [
                        { label: 'Simple', value: 'Simple' },
                        // { label: "Detailed BOM", value: "Detailed_BOM" }
                    ]
                },
                {
                    type: 'fieldArray',
                    name: 'inputs',
                    label: 'Define Ingredients / Raw Materials',
                    arraySectionName: "Master Inputs",
                    condition: { field: 'costing_mode', value: 'Detailed_BOM' },
                    parentStyles: "sm:col-span-2",
                    minimumSections: 1,
                    fields: [
                        { type: 'text', name: 'input_name', label: 'Input Name', placeholder: 'e.g. Pink Rock Salt', isComp: true },
                        { type: 'select', name: 'uom', label: 'UOM', options: [{ label: 'kg', value: 'kg' }, { label: 'gram', value: 'gram' }, { label: 'liter', value: 'liter' }, { label: 'piece', value: 'piece' }], isComp: true },
                        { type: 'number', name: 'unit_cost', label: 'Cost per Unit', placeholder: '0.00', isComp: true },
                        { type: 'textarea', name: 'supplier_notes', label: 'Supplier Notes', placeholder: 'Preferred supplier...', isComp: false }
                    ]
                },
                {
                    type: 'fieldArray',
                    name: 'packaging_materials',
                    label: 'Define Packaging Materials',
                    arraySectionName: "Master Packaging Materials",
                    condition: { field: 'costing_mode', value: 'Detailed_BOM' },
                    parentStyles: "sm:col-span-2",
                    minimumSections: 1,
                    fields: [
                        { type: 'text', name: 'material_name', label: 'Material Name', placeholder: 'e.g. 1kg Standup Pouch', isComp: true },
                        { type: 'select', name: 'uom', label: 'UOM', options: [{ label: 'piece', value: 'piece' }, { label: 'meter', value: 'meter' }, { label: 'kg', value: 'kg' }], isComp: true },
                        { type: 'number', name: 'unit_cost', label: 'Cost per Unit', placeholder: '0.00', isComp: true }
                    ]
                },
                {
                    type: 'fieldArray',
                    name: 'products',
                    label: 'Product List',
                    arraySectionName: "Product",
                    parentStyles: "sm:col-span-2",
                    minimumSections: 1,
                    fields: [
                        // --- 3.1 Basic SKU Identity ---
                        { type: 'text', name: 'sku_name', label: 'SKU Name', isComp: true, placeholder: 'e.g. Pink Salt Fine – 1kg pouch', parentStyles: "sm:col-span-2" },

                        {
                            type: 'select',
                            name: 'product_category',
                            isComp: true,
                            label: 'Product Category',
                            placeholder: 'Select Category',
                            options: [
                                { label: 'Edible Fine', value: 'Edible Fine' },
                                { label: 'Edible Coarse', value: 'Edible Coarse' },
                                { label: 'Bath Salt', value: 'Bath Salt' },
                                { label: 'Salt Chunks', value: 'Salt Chunks' },
                                { label: 'Salt Lamp/Decor', value: 'Salt Lamp/Decor' },
                                { label: 'Industrial', value: 'Industrial' }
                            ]
                        },

                        {
                            type: 'select',
                            name: 'uom',
                            placeholder: 'Select UOM',
                            label: 'Unit of Measure',
                            isComp: true,
                            options: [{ label: 'kg', value: 'kg' }, { label: 'piece', value: 'piece' }, { label: 'pack', value: 'pack' }]
                        },

                        {
                            type: 'number',
                            name: 'pack_size_g',
                            label: 'Pack Size (grams)',
                            placeholder: 'e.g. 500',
                            isComp: true,
                            condition: { field: 'uom', value: 'pack' }
                        },

                        {
                            type: 'select',
                            name: 'target_market',
                            placeholder: 'Select Market',
                            label: 'Target Market',
                            isComp: true,
                            options: [{ label: 'Domestic', value: 'Domestic' }, { label: 'Export', value: 'Export' }, { label: 'Both', value: 'Both' }]
                        },

                        // --- 3.2 Capacity & Utilization ---
                        { type: 'number', name: 'installed_capacity_per_month', label: 'Installed Capacity Per (Monthly)', isComp: true, placeholder: 'tons or packs/month' },
                        { type: 'number', name: 'year1_capacity_utilization_percent', label: 'Year 1 Utilization (%)', isComp: true, placeholder: 'e.g. 50' },
                        { type: 'number', name: 'year2_capacity_utilization_percent', label: 'Year 2 Utilization (%)', isComp: false, placeholder: 'e.g. 60' },
                        { type: 'number', name: 'year3_capacity_utilization_percent', label: 'Year 3 Utilization (%)', isComp: false, placeholder: 'e.g. 70' },

                        // --- 3.3 Pricing ---
                        { type: 'Title', label: 'Pricing Strategy', parentStyles: "sm:col-span-2" },

                        {
                            type: 'number',
                            name: 'domestic_selling_price_per_unit',
                            label: 'Domestic Selling Price per Unit',
                            isComp: false,
                            placeholder: '0.00',
                            requiredCondition: { field: 'target_market', operator: 'in', value: ['Domestic', 'Both'] }
                        },
                        {
                            type: 'number',
                            name: 'export_selling_price_per_unit',
                            label: 'Export Selling Price per Unit',
                            isComp: false,
                            placeholder: '0.00',
                            requiredCondition: { field: 'target_market', operator: 'in', value: ['Export', 'Both'] }
                        },
                        {
                            type: 'select',
                            name: 'export_price_currency',
                            label: 'Export Price Currency',
                            isComp: false,
                            requiredCondition: { field: 'export_selling_price_per_unit', operator: 'isNotEmpty' },
                            placeholder: 'Select Export Price Currency',
                            options: [{ label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }, { label: 'GBP', value: 'GBP' }],
                        },
                        { type: 'number', name: 'expected_discount_or_commission_percent', label: 'Discount/Commission (%)', isComp: false, placeholder: 'e.g. 2' },

                        // ==========================================
                        // 3.4 SIMPLE MODE SECTION (INSIDE PRODUCT ARRAY)
                        // ==========================================
                        {
                            type: 'Title',
                            label: 'Direct Cost Estimates (Simple Mode)',
                            parentStyles: "sm:col-span-2",
                            condition: { field: 'costing_mode', value: 'Simple' }
                        },

                        {
                            type: 'number',
                            name: 'net_salt_content_per_unit_kg',
                            label: 'Net Salt Content per Unit (kg)',
                            isComp: true,
                            placeholder: '0',
                            condition: { field: 'costing_mode', value: 'Simple' }
                        },
                        {
                            type: 'number',
                            name: 'packaging_cost_per_unit',
                            label: 'Packaging Cost (Per Unit)',
                            isComp: true,
                            placeholder: 'pouch/jar/label/carton allocation',
                            condition: { field: 'costing_mode', value: 'Simple' }
                        },
                        {
                            type: 'number',
                            name: 'direct_labor_cost_per_unit',
                            label: 'Direct Labor Cost (Per Unit)',
                            isComp: false,
                            placeholder: '0.00',
                            condition: { field: 'costing_mode', value: 'Simple' }
                        },
                        {
                            type: 'number',
                            name: 'qc_testing_cost_per_unit',
                            label: 'QC / Testing Cost (Per Unit)',
                            isComp: false,
                            placeholder: '0.00',
                            condition: { field: 'costing_mode', value: 'Simple' }
                        },
                        {
                            type: 'number',
                            name: 'other_variable_cost_per_unit',
                            label: 'Other Variable Costs (Per Unit)',
                            isComp: false,
                            placeholder: '0.00',
                            condition: { field: 'costing_mode', value: 'Simple' }
                        },

                        // -- Calculated Read-only fields for Simple Mode --
                        {
                            type: 'number',
                            name: 'gross_salt_required_per_unit_kg',
                            label: 'Gross Salt Required Per Unit (kg)',
                            disabled: true,
                            placeholder: '0',
                            condition: { field: 'costing_mode', value: 'Simple' }
                        },
                        {
                            type: 'number',
                            name: 'raw_salt_cost_per_unit',
                            label: 'Raw Salt Cost (Per Unit)',
                            disabled: true,
                            placeholder: '0',
                            condition: { field: 'costing_mode', value: 'Simple' }
                        },
                        { type: 'number', name: 'unit_variable_cost', label: 'Unit Variable Cost', disabled: true, placeholder: '0.00' },


                        // ==========================================
                        // 3.5 DETAILED BOM MODE SECTION (INSIDE PRODUCT ARRAY)
                        // ==========================================
                        {
                            type: 'Title',
                            label: 'Bill of Materials',
                            parentStyles: "sm:col-span-2",
                            condition: { field: 'costing_mode', value: 'Detailed_BOM' }
                        },

                        {
                            type: 'fieldArray',
                            name: 'product_bom',
                            label: 'BOM Components',
                            arraySectionName: "Component",
                            condition: { field: 'costing_mode', value: 'Detailed_BOM' },
                            parentStyles: "sm:col-span-2",
                            fields: [
                                { type: 'select', name: 'component_type', label: 'Component Type', options: [{ label: 'Input', value: 'Input' }, { label: 'Packaging', value: 'Packaging' }], isComp: true },
                                { type: 'text', name: 'component_name', label: 'Component Name', placeholder: 'Select from Master', isComp: true },
                                { type: 'number', name: 'consumption_per_unit', label: 'Consumption Per Unit', placeholder: 'Qty used', isComp: true },
                                { type: 'number', name: 'scrap_percent', label: 'Scrap %', placeholder: '0', isComp: false },
                                { type: 'number', name: 'calculated_cost_contribution', label: 'Cost', disabled: true, placeholder: '0.00' }
                            ]
                        },
                        // Additional costs for Detailed Mode
                        { type: 'number', name: 'qc_testing_cost_per_unit_bom', label: 'QC / Testing Cost', condition: { field: 'costing_mode', value: 'Detailed_BOM' } },
                        { type: 'number', name: 'other_variable_cost_per_unit_bom', label: 'Other Variable Costs', condition: { field: 'costing_mode', value: 'Detailed_BOM' } },


                        // // --- 3.6 Product Results (Common) ---
                        // { type: 'Title', label: 'Unit Economics Summary', parentStyles: "sm:col-span-2" },
                        // { type: 'number', name: 'unit_material_cost', label: 'Total Material Cost', disabled: true, placeholder: '0.00' },

                        // { type: 'number', name: 'gross_units_y1', label: 'Gross Units (Y1)', disabled: true, placeholder: '0' },
                        // { type: 'number', name: 'good_units_y1', label: 'Good Units (Y1)', disabled: true, placeholder: '0' },

                        // // --- Year 1 ---
                        // { type: 'Title', label: 'Year-1 Financials', },
                        // { type: 'number', name: 'monthly_revenue_product', label: 'Monthly Revenue', disabled: true, placeholder: '0' },
                        // { type: 'number', name: 'monthly_cogs_product', label: 'Monthly COGS', disabled: true, placeholder: '0' },

                        // // --- Year 2 ---
                        // { type: 'Title', label: 'Year-2 Financials', },
                        // { type: 'number', name: 'monthly_revenue_product_year2', label: 'Monthly Revenue', disabled: true, placeholder: '0' },
                        // { type: 'number', name: 'monthly_cogs_product_year2', label: 'Monthly COGS', disabled: true, placeholder: '0' },

                        // // --- Year 3 ---
                        // { type: 'Title', label: 'Year-3 Financials', },
                        // { type: 'number', name: 'monthly_revenue_product_year3', label: 'Monthly Revenue', disabled: true, placeholder: '0' },
                        // { type: 'number', name: 'monthly_cogs_product_year3', label: 'Monthly COGS', disabled: true, placeholder: '0' },
                    ]
                },

                // ==========================================
                // 4. GLOBAL TOTALS
                // ==========================================

                // // Year 1
                // { type: 'Title', label: 'Year-1 Portfolio Totals (Monthly)', },
                // { type: 'number', name: 'monthly_revenue_total', label: 'Total Revenue', disabled: true, placeholder: '0' },
                // { type: 'number', name: 'monthly_cogs_total', label: 'Total COGS', disabled: true, placeholder: '0' },
                // { type: 'number', name: 'monthly_gross_profit', label: 'Gross Profit', disabled: true, placeholder: '0', parentStyles: "sm:col-span-2" },

                // // Year 2
                // { type: 'Title', label: 'Year-2 Portfolio Totals (Monthly)', },
                // { type: 'number', name: 'monthly_revenue_total_year2', label: 'Total Revenue', disabled: true, placeholder: '0' },
                // { type: 'number', name: 'monthly_cogs_total_year2', label: 'Total COGS', disabled: true, placeholder: '0' },
                // { type: 'number', name: 'monthly_gross_profit_year2', label: 'Gross Profit', disabled: true, placeholder: '0', parentStyles: "sm:col-span-2" },

                // // Year 3
                // { type: 'Title', label: 'Year-3 Portfolio Totals (Monthly)', },
                // { type: 'number', name: 'monthly_revenue_total_year3', label: 'Total Revenue', disabled: true, placeholder: '0' },
                // { type: 'number', name: 'monthly_cogs_total_year3', label: 'Total COGS', disabled: true, placeholder: '0' },
                // { type: 'number', name: 'monthly_gross_profit_year3', label: 'Gross Profit', disabled: true, placeholder: '0', parentStyles: "sm:col-span-2" },
            ]
        },
        {
            title: "6. Processing & Operations Assumptions",
            columns: 2,
            fields: [
                { type: 'textarea', name: 'process_flow_overview', label: 'Process Flow Overview', placeholder: 'e.g., sourcing -> washing -> drying -> crushing/grinding -> sieving -> packing -> palletizing', isComp: true, parentStyles: "sm:col-span-2" },
                { type: 'number', name: 'shifts_per_day', label: 'Shifts per Day', placeholder: 'e.g. 1', isComp: true },
                { type: 'number', name: 'working_days_per_month', label: 'Working Days per Month', placeholder: 'e.g. 26', isComp: true },
                { type: 'number', name: 'maintenance_days_per_month', label: 'Maintenance Days per Month', placeholder: 'e.g. 1', isComp: false },
                { type: 'select', name: 'batch_traceability', label: 'Batch Traceability', placeholder: 'Select Traceability', isComp: false, options: [{ label: 'Manual', value: 'Manual' }, { label: 'Batch Codes', value: 'Batch Codes' }, { label: 'ERP', value: 'ERP' }] },
                { type: 'checkboxGroup', name: 'quality_checks', label: 'Quality Checks', isComp: true, parentStyles: "sm:col-span-2", options: [{ label: 'Moisture', value: 'Moisture' }, { label: 'NaCl%', value: 'NaCl%' }, { label: 'Particle size', value: 'Particle size' }, { label: 'Foreign matter', value: 'Foreign matter' }, { label: 'Packaging integrity', value: 'Packaging integrity' }] },
            ]
        },
        {
            title: "7. Regulatory, Certifications & Export Compliance", columns: 2,
            fields: [
                // 8A) Domestic Compliance
                { type: 'select', name: 'food_authority_registration', placeholder: "Select Food Authority Registration", parentStyles: "sm:col-span-2", label: 'Food Authority Registration', isComp: true, options: [{ label: 'Not Applied', value: 'Not Applied' }, { label: 'In Process', value: 'In Process' }, { label: 'Approved', value: 'Approved' }] },
                { type: 'checkbox', name: 'psqca_applicable', label: 'PSQCA Applicable?', isComp: false },
                { type: 'checkbox', name: 'halal_cert_required', label: 'Halal Certification Required?', isComp: false },

                // 8B) Export Compliance (Condition: exporting_enabled = true)
                { type: 'checkboxGroup', name: 'export_target_regions', label: 'Export Target Regions', isComp: true, parentStyles: "sm:col-span-2", options: [{ label: 'USA', value: 'USA' }, { label: 'UK/EU', value: 'UK/EU' }, { label: 'GCC', value: 'GCC' }, { label: 'China', value: 'China' }, { label: 'SEA', value: 'SEA' }, { label: 'Other', value: 'Other' }], condition: { field: 'exporting_enabled', value: true } },
                { type: 'text', name: 'hs_code_primary', label: 'Primary HS Code', placeholder: 'HS 2501...', isComp: true, condition: { field: 'exporting_enabled', value: true } },
                { type: 'textarea', name: 'labeling_language_requirements', label: 'Labeling Language Requirements', placeholder: 'Describe (e.g., English/Arabic)', isComp: false, parentStyles: "sm:col-span-2", condition: { field: 'exporting_enabled', value: true } },
                { type: 'checkbox', name: 'third_party_inspection_required', label: 'Third Party Inspection Required?', isComp: false, condition: { field: 'exporting_enabled', value: true } },

                {
                    type: 'fieldArray', name: 'certifications', label: 'Certifications', arraySectionName: 'Certification',
                    condition: { field: 'exporting_enabled', value: true },
                    parentStyles: "sm:col-span-2",
                    fields: [
                        { type: 'select', name: 'cert_name', placeholder: "Select Certification", label: 'Certification Name', options: [{ label: 'ISO 22000', value: 'ISO 22000' }, { label: 'HACCP', value: 'HACCP' }, { label: 'Organic', value: 'Organic' }, { label: 'Other', value: 'Other' }], isComp: false },
                        { type: 'select', name: 'status', label: 'Status', options: [{ label: 'Planned', value: 'Planned' }, { label: 'In Process', value: 'In Process' }, { label: 'Certified', value: 'Certified' }], isComp: false },
                        { type: 'number', name: 'one_time_cost', label: 'One Time Cost', placeholder: '0', isComp: false },
                        { type: 'number', name: 'annual_cost', label: 'Annual Cost', placeholder: '0', isComp: false },
                    ]
                },

                { type: 'checkboxGroup', name: 'export_docs_needed', placeholder: "Select Export Documents", label: 'Export Documents Needed', isComp: false, parentStyles: "sm:col-span-2", options: [{ label: 'Commercial Invoice', value: 'Commercial Invoice' }, { label: 'Packing List', value: 'Packing List' }, { label: 'Certificate of Origin', value: 'Certificate of Origin' }, { label: 'E-form', value: 'E-form' }, { label: 'GD (WeBOC)', value: 'GD (WeBOC)' }, { label: 'Inspection cert', value: 'Inspection cert' }], condition: { field: 'exporting_enabled', value: true } },
            ]
        },
        {
            title: "8. Export Logistics & Order Assumptions", columns: 2,
            fields: [
                { type: 'select', name: 'export_mode', placeholder: "Select Export Mode", label: 'Export Mode', isComp: true, options: [{ label: 'Sea', value: 'Sea' }, { label: 'Air', value: 'Air' }, { label: 'Road', value: 'Road' }], condition: { field: 'exporting_enabled', value: true } },
                { type: 'select', name: 'incoterm', placeholder: "Select Incoterm", label: 'Incoterm', isComp: true, options: [{ label: 'EXW', value: 'EXW' }, { label: 'FOB', value: 'FOB' }, { label: 'CIF', value: 'CIF' }, { label: 'DAP', value: 'DAP' }], condition: { field: 'exporting_enabled', value: true } },
                { type: 'number', name: 'shipment_frequency_per_month', label: 'Shipment Frequency (Per Month)', placeholder: 'e.g. 2', isComp: false, condition: { field: 'exporting_enabled', value: true } },
                { type: 'number', name: 'avg_export_order_size_kg', label: 'Avg Export Order Size (KG)', placeholder: '0', isComp: true, condition: { field: 'exporting_enabled', value: true } },
                { type: 'text', name: 'port_of_loading', placeholder: "Enter Port of Loading", label: 'Port of Loading', isComp: true, condition: { field: 'exporting_enabled', value: true } },
                { type: 'number', name: 'freight_cost_per_kg_or_container', label: 'Freight Cost Per KG or Container', placeholder: '0', isComp: true, condition: { field: 'exporting_enabled', value: true } },
                { type: 'number', name: 'insurance_cost_monthly', label: 'Insurance Cost (Monthly)', placeholder: '0', isComp: false, condition: { field: 'exporting_enabled', value: true } },
                { type: 'number', name: 'clearing_forwarding_cost_per_shipment', label: 'Clearing & Forwarding (Per Shipment)', placeholder: '0', isComp: false, condition: { field: 'exporting_enabled', value: true } },
                { type: 'select', name: 'export_payment_term', placeholder: "Select Payment Term", label: 'Payment Term', isComp: true, options: [{ label: 'Advance', value: 'Advance' }, { label: 'LC', value: 'LC' }, { label: 'Documents against Payment', value: 'Documents against Payment' }, { label: 'Net-30/60', value: 'Net-30/60' }], condition: { field: 'exporting_enabled', value: true } },
                { type: 'number', name: 'expected_export_receivables_days', label: 'Expected Receivables Days', placeholder: '45', isComp: true, condition: { field: 'exporting_enabled', value: true } },
                { type: 'number', name: 'monthly_export_logistics_cost', disabled: true, label: 'Monthly Export Logistics Cost', placeholder: '0', isComp: false, condition: { field: 'exporting_enabled', value: true } },
            ]
        },
        {
            title: "9. Capex (Infrastructure & Machinery)", columns: 2,
            fields: [
                {
                    type: 'fieldArray', name: 'capex_items', label: 'Capex Items', arraySectionName: 'Item', minimumSections: 1, parentStyles: "sm:col-span-2",
                    fields: [
                        { type: 'text', name: 'item_name', label: 'Item Name', placeholder: "e.g. Salt washer", isComp: true },
                        { type: 'select', placeholder: "Select Category", name: 'category', label: 'Category', isComp: true, options: [{ label: 'Building/Renovation', value: 'Building/Renovation' }, { label: 'Machinery', value: 'Machinery' }, { label: 'Utilities Setup', value: 'Utilities Setup' }, { label: 'Lab/QC', value: 'Lab/QC' }, { label: 'Forklift/Handling', value: 'Forklift/Handling' }, { label: 'IT/ERP', value: 'IT/ERP' }, { label: 'Vehicle', value: 'Vehicle' }, { label: 'Furniture', value: 'Furniture' }, { label: 'Pre-Op', value: 'Pre-Op' }] },
                        { type: 'number', placeholder: "0", name: 'quantity', label: 'Qty', isComp: true },
                        { type: 'number', placeholder: "0", name: 'rate_per_unit', label: 'Rate', isComp: true },
                        { type: 'number', placeholder: "0", name: 'total_cost', label: 'Total', disabled: true, isComp: false },
                        { type: 'text', name: 'remarks', label: 'Remarks', isComp: false }
                    ]
                },

                { type: 'number', placeholder: "0", name: 'contingency_percent', label: 'Contingency %', isComp: false },
                { type: 'number', placeholder: "0", name: 'preoperating_cost_lump_sum', label: 'Pre-operating Cost (Lump Sum)', isComp: true },
                { type: 'number', placeholder: "0", name: 'capex_subtotal', label: 'Capex Subtotal', disabled: true, isComp: false },
                { type: 'number', placeholder: "0", name: 'contingency_amount', label: 'Contingency Amount', disabled: true, isComp: false },

                { type: 'number', placeholder: "0", name: 'total_capex', label: 'Total Capex Cost', disabled: true, isComp: false }
            ]
        },
        {
            title: "10. HR & Payroll", columns: 1,
            fields: [
                {
                    type: 'fieldArray', name: 'staff', label: 'Staffing Plan', arraySectionName: 'Staff', minimumSections: 1,
                    fields: [
                        { type: 'text', name: 'role', label: 'Role', placeholder: "e.g. Production Supervisor", isComp: true },
                        { type: 'number', placeholder: "0", name: 'count', label: 'Count', isComp: true },
                        { type: 'number', placeholder: "0", name: 'monthly_salary_per_person', label: 'Monthly Salary (Per Person)', isComp: true },
                        { type: 'checkbox', name: 'is_direct_labor', label: 'Direct Labor?', isComp: false }
                    ]
                },
                { type: 'number', placeholder: "0", name: 'monthly_payroll_total', label: 'Total Monthly Payroll', disabled: true, isComp: false },
                { type: 'number', placeholder: "0", name: 'monthly_direct_labor_total', label: 'Total Direct Labor', disabled: true, isComp: false },
                { type: 'number', placeholder: "0", name: 'monthly_indirect_labor_total', label: 'Total Indirect Labor', disabled: true, isComp: false }
            ]
        },
        {
            title: "11. Monthly Operating Expenses (Overheads)", columns: 2,
            fields: [
                { type: 'number', placeholder: "0", name: 'electricity_cost_monthly', label: 'Electricity Cost Monthly', isComp: true },
                { type: 'number', placeholder: "0", name: 'water_cost_monthly', label: 'Water Cost Monthly', isComp: false },
                { type: 'number', placeholder: "0", name: 'fuel_transport_monthly', label: 'Fuel/Transport Monthly', isComp: false },
                { type: 'number', placeholder: "0", name: 'maintenance_cost_monthly', label: 'Maintenance Cost Monthly', isComp: true },
                { type: 'number', placeholder: "0", name: 'rent_monthly', label: 'Rent (Monthly)', disabled: true, isComp: false },
                { type: 'number', placeholder: "0", name: 'admin_expenses_monthly', label: 'Admin Expenses Monthly', isComp: true },
                { type: 'number', placeholder: "0", name: 'sales_marketing_monthly', label: 'Sales & Marketing Monthly', isComp: true },
                { type: 'number', placeholder: "0", name: 'qc_lab_consumables_monthly', label: 'QC/Lab Consumables Monthly', isComp: false },
                { type: 'number', placeholder: "0", name: 'export_marketing_cost_monthly', label: 'Export Marketing Cost Monthly', isComp: false, condition: { field: 'exporting_enabled', value: true } },
                { type: 'number', placeholder: "0", name: 'misc_monthly', label: 'Miscellaneous Monthly', isComp: false },
                { type: 'number', placeholder: "0", name: 'monthly_overheads_total', label: 'Total Overheads Monthly', disabled: true, isComp: false }
            ]
        },
        {
            title: "12. Revenue, COGS, Gross Profit (Auto Section)", columns: 2,
            fields: [
                { type: 'number', placeholder: "0", name: 'monthly_revenue_total', label: 'Total Revenue (Monthly)', disabled: true, isComp: false },
                { type: 'number', placeholder: "0", name: 'monthly_cogs_total', label: 'Total COGS (Monthly)', disabled: true, isComp: false },
                { type: 'number', placeholder: "0", name: 'monthly_gross_profit', label: 'Gross Profit (Monthly)', disabled: true, isComp: false },
                { type: 'number', placeholder: "0", name: 'monthly_net_profit_before_finance', label: 'Net Profit Before Finance', disabled: true, isComp: false }
            ]
        },
        {
            title: "13. Working Capital Module", columns: 2,
            fields: [
                { type: 'number', placeholder: "30", name: 'raw_material_inventory_days', label: 'Raw Material Inventory Days', isComp: false },
                { type: 'number', placeholder: "30", name: 'packaging_inventory_days', label: 'Packaging Inventory Days', isComp: false },
                { type: 'number', placeholder: "15", name: 'finished_goods_inventory_days', label: 'finished Goods Inv. Days', isComp: false },
                { type: 'number', placeholder: "15", name: 'payables_days', label: 'Payables Days', isComp: false },
                { type: 'number', placeholder: "30", name: 'domestic_receivables_days', label: 'Domestic Receivables Days', isComp: false },
                { type: 'number', placeholder: "45", name: 'export_receivables_days', label: 'Export Receivables Days', isComp: false },
                { type: 'number', placeholder: "10", name: 'cash_buffer_days', label: 'Cash Buffer Days', isComp: false },
                { type: 'number', placeholder: "0", name: 'working_capital_required', label: 'Total Working Capital Required', disabled: true, isComp: false },
                // Hidden or Disabled intermediate results if user wants to see them
                { type: 'number', placeholder: "0", name: 'inventory_investment', label: 'Inventory Investment', disabled: true, isComp: false },
                { type: 'number', placeholder: "0", name: 'receivables_investment', label: 'Receivables Investment', disabled: true, isComp: false }
            ]
        },
        // {
        //     title: "14. Financing", columns: 2,
        //     fields: [
        //         { type: 'number', placeholder: "0", name: 'loan_amount_requested', label: 'Loan Amount', isComp: true },
        //         { type: 'number', placeholder: "0", name: 'owner_equity_contribution', label: 'Owner Equity', isComp: true },
        //         { type: 'number', placeholder: "0", name: 'markup_rate_percent', label: 'Markup Rate %', isComp: true },
        //         { type: 'number', placeholder: "0", name: 'tenor_years', label: 'Tenor (Years)', isComp: true },
        //         { type: 'number', placeholder: "0", name: 'grace_period_months', label: 'Grace Period (Months)', isComp: true },
        //         { type: 'select', placeholder: 'Select Installment Type', name: 'installment_type', label: 'Installment Type', options: [{ label: 'EMI', value: 'EMI' }, { label: 'Equal Principal', value: 'Equal Principal' }, { label: 'Custom', value: 'Custom' }], isComp: true },
        //         { type: 'number', placeholder: "0", name: 'installment_amount', label: 'Installment Amount', isComp: false, disabled: true, } // Removed disabled so Custom works. EMI will strictly overwrite.
        //     ]
        // },

        // copy component form test 3 file 
        {
            title: "14. Financing & Loan Terms",
            // description: "Define the debt structure and calculate monthly debt service.",
            columns: 2,
            fields: [
                {
                    type: 'number',
                    name: 'loan_amount_requested',
                    label: 'Loan Amount Requested (PKR)',
                    isComp: true,
                    placeholder: 'e.g. 10000000'
                },
                {
                    type: 'number',
                    name: 'owner_equity_contribution',
                    label: 'Owner Equity Contribution',
                    isComp: true,
                    placeholder: 'e.g. 2000000'
                },
                {
                    type: 'number',
                    name: 'markup_rate_percent',
                    label: 'Markup / Interest Rate (%)',
                    isComp: true,
                    disabled: true,
                    placeholder: 'e.g. 18'
                },
                {
                    type: 'number',
                    name: 'grace_period_months',
                    label: 'Grace Period',
                    isComp: true,
                    placeholder: 'e.g. 6'
                },
                {
                    type: 'number',
                    name: 'tenor_years',
                    label: 'Loan Tenor (Years)',
                    isComp: true,
                    placeholder: 'e.g. 5'
                },
                {
                    type: 'number',
                    name: 'num_installments',
                    label: 'Number of Installments',
                    disabled: true,
                    placeholder: '0'
                },
                // {
                //     type: 'select',
                //     name: 'installment_type',
                //     label: 'Installment Type',
                //     placeholder: 'Select Installment Type',
                //     isComp: true,
                //     options: [
                //         { label: 'EMI', value: 'EMI' },
                //         { label: 'Equal Principal', value: 'Equal Principal' },
                //         { label: 'Custom', value: 'Custom' }
                //     ]
                // },


                {
                    type: 'number',
                    name: 'installment_amount',
                    label: 'Estimated Monthly Installment',
                    disabled: true,
                    placeholder: '0'
                },
            ]
        },
        {
            title: "15. Risks & Mitigation",
            columns: 1,
            fields: [
                {
                    type: 'fieldArray',
                    name: 'risks',
                    label: 'Risk Assessment',
                    arraySectionName: "Risk",
                    minimumSections: 1,
                    fields: [
                        { type: 'text', name: 'risk_title', label: 'Risk Title', placeholder: 'e.g. Export payment delays', isComp: true },
                        { type: 'textarea', name: 'impact_description', label: 'Impact Description', placeholder: 'e.g. Cash flow shortage impacting raw material purchase...', isComp: true },
                        { type: 'textarea', name: 'mitigation_strategy', label: 'Mitigation Strategy', placeholder: 'e.g. Use LC at sight or Export Credit Guarantee...', isComp: true },
                        {
                            type: 'select', placeholder: 'Select Severity Level', name: 'severity_level', label: 'Severity Level',
                            options: [{ label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }],
                            isComp: false
                        }
                    ]
                }
            ]
        },
        {
            title: "16. ESG / Safety / Environmental",
            columns: 2,
            fields: [
                { type: 'textarea', name: 'dust_control_measures', label: 'Dust Control Measures', placeholder: 'Describe measures...', isComp: false, parentStyles: "sm:col-span-2" },
                { type: 'textarea', name: 'worker_safety_measures', label: 'Worker Safety Measures', placeholder: 'Describe measures...', isComp: false, parentStyles: "sm:col-span-2" },
                { type: 'textarea', name: 'waste_management_plan', label: 'Waste Management Plan', placeholder: 'Describe plan...', isComp: false, parentStyles: "sm:col-span-2" },
                { type: 'textarea', name: 'sustainability_notes', label: 'Sustainability Notes', placeholder: 'Additional notes...', isComp: false, parentStyles: "sm:col-span-2" }
            ]
        },
        {
            title: "17. Conclusion & Objectives (Optional)",
            columns: 2,
            fields: [
                { type: 'textarea', name: 'project_objectives_custom', label: 'Project Objectives', placeholder: 'State primary goals...', isComp: false, parentStyles: "sm:col-span-2" },
                { type: 'textarea', name: 'conclusion_custom_notes', label: 'Conclusion / Final Notes', placeholder: 'Summary...', isComp: false, parentStyles: "sm:col-span-2" }
            ]
        }
    ]
};// --- 3. Calculations Component ---
const PinkSaltCalculations = () => {
    const { watch, setValue, getValues } = useFormContext();

    // // 1. Yield Logic
    // // 1. Yield Logic (Section 4)
    useEffect(() => {
        const calculateYield = () => {
            const allVals = getValues();
            const s = Number(allVals.sorting_wastage_percent || 0);
            const w = Number(allVals.washing_loss_percent || 0);
            const g = Number(allVals.grinding_sieving_loss_percent || 0);

            const newTotal = s + w + g;
            const currentTotal = Number(allVals.total_process_loss_percent || 0);

            if (Math.abs(currentTotal - newTotal) > 0.01) {
                setValue('total_process_loss_percent', newTotal, {
                    shouldValidate: true,
                    shouldDirty: true
                });
            }
        };

        // 1. Run immediately on mount to handle default values
        calculateYield();

        // 2. Subscribe to changes
        const sub = watch((value, { name }) => {
            const relevantFields = [
                'sorting_wastage_percent',
                'washing_loss_percent',
                'grinding_sieving_loss_percent'
            ];

            // Trigger on bulk load (!name) or specific field change
            if (!name || relevantFields.includes(name)) {
                calculateYield();
            }
        });

        return () => sub.unsubscribe();
    }, [watch, setValue, getValues]);

    // // Sections 5. Product Costing & Revenue
    // Product Costing & Revenue Calculation Hook
    useEffect(() => {
        const subscription = watch((formValues, { name }) => {
            // --- 1. Guard Clauses (Your Exact Logic) ---
            // "isBulkLoad" is true if name is undefined (happens on form mount/reset)
            const isBulkLoad = !name;

            // CRITICAL: You MUST list EVERY field that you setValue() here.
            // If you miss one, you will get an infinite loop.
            const calculatedFields = [
                'gross_salt_required_per_unit_kg',
                'raw_salt_cost_per_unit',
                'unit_variable_cost',
                'calculated_cost_contribution', // For BOM lines
                'unit_material_cost',
                'monthly_revenue_sku',
                'monthly_cogs_sku',
                'monthly_revenue_total',
                'monthly_cogs_total',
                'monthly_gross_profit'
            ];

            // Check if the trigger is inside 'products' AND is NOT a calculated field
            const isProductInput = name?.includes('products') &&
                !calculatedFields.some(field => name?.includes(field));

            // Check Global triggers
            const globalTriggers = [
                'costing_mode',
                'raw_salt_purchase_price_per_kg',
                'fx_usd_to_pkr',
                'total_process_loss_percent',
                'inputs',
                'packaging_materials'
            ];
            const isGlobalTrigger = globalTriggers.some(t => name?.includes(t));

            // THE LOGIC YOU WANTED:
            // If it is NOT bulk load, NOT a valid product input, and NOT a global trigger -> Stop.
            if (!isBulkLoad && !isProductInput && !isGlobalTrigger) return;


            // --- 2. Helper Functions ---
            const updateIfChanged = (path: any, newVal: number, isFloat = false) => {
                const currentVal = Number(getValues(path) || 0);
                const safeNew = isFloat ? Number(newVal.toFixed(2)) : Math.round(newVal);
                const safeCur = isFloat ? Number(currentVal.toFixed(2)) : Math.round(currentVal);

                if (Math.abs(safeCur - safeNew) > (isFloat ? 0.001 : 0.5)) {
                    // Force validation and touch to ensure UI components (especially Controlled ones) re-render
                    setValue(path, safeNew, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                }
            };

            // --- 3. Prepare Data ---
            // We use getValues() to ensure we have the full complete state
            const allValues = getValues();
            const mode = allValues.costing_mode || 'Simple';
            const products = allValues.products || [];
            const rawSaltPrice = Number(allValues.raw_salt_purchase_price_per_kg || 0);
            const fxRate = Number(allValues.fx_usd_to_pkr || 280);
            const processLossPercent = Number(allValues.total_process_loss_percent || 0);
            const masterInputs = allValues.inputs || [];
            const masterPackaging = allValues.packaging_materials || [];

            let totalRev = 0;
            let totalCOGS = 0;

            // --- 4. Iterate and Calculate ---
            products.forEach((p: any, idx: number) => {

                // Helper to safely get number (converts "100", undefined, null -> 100 or 0)
                const val = (v: any) => Number(v) || 0;

                // ============================================
                // A. OVERWRITE PROTECTION (Pack Size vs Net Salt)
                // ============================================
                let netSalt = val(p.net_salt_content_per_unit_kg);

                const isRowTrigger = name?.includes(`products.${idx}.`);
                const isPackTrigger = name?.includes('pack_size_g') || name?.includes('uom');

                if (p.uom === 'pack' && (isBulkLoad || (isRowTrigger && isPackTrigger))) {
                    const packSize = val(p.pack_size_g);
                    if (packSize > 0) {
                        netSalt = packSize / 1000;
                        updateIfChanged(`products[${idx}].net_salt_content_per_unit_kg`, netSalt, true);
                    }
                }

                // ============================================
                // B. COMMON CALCULATIONS
                // ============================================
                const installedCapacity = val(p.installed_capacity_per_month);
                const utilization = val(p.year1_capacity_utilization_percent) || 50; // Default 50 if empty
                const grossUnits = installedCapacity * (utilization / 100);

                // ============================================
                // C. UNIT VARIABLE COST
                // ============================================
                let unitVarCost = 0;

                if (mode === 'Simple') {
                    // 1. Gross Salt
                    const lossFactor = 1 - (processLossPercent / 100);
                    // Prevent division by zero if loss is 100%
                    const grossSalt = (lossFactor > 0.01) ? netSalt / lossFactor : netSalt;

                    updateIfChanged(`products[${idx}].gross_salt_required_per_unit_kg`, grossSalt, true);

                    // 2. Raw Salt Cost (CRITICAL FIX HERE)
                    // If rawSaltPrice is 0 or undefined, this becomes 0 instead of NaN
                    const safeRawPrice = val(rawSaltPrice);
                    const rawCost = grossSalt * safeRawPrice;

                    updateIfChanged(`products[${idx}].raw_salt_cost_per_unit`, rawCost, true);

                    // 3. Sum Variable Costs
                    unitVarCost = rawCost +
                        val(p.packaging_cost_per_unit) +
                        val(p.direct_labor_cost_per_unit) +
                        val(p.qc_testing_cost_per_unit) +
                        val(p.other_variable_cost_per_unit);
                }
                else if (mode === 'Detailed_BOM') {
                    const bom = p.product_bom || [];
                    let unitMaterialCost = 0;

                    bom.forEach((item: any, bIdx: number) => {
                        const normalize = (s: string) => (s || '').trim().toLowerCase();
                        let rate = 0;

                        if (item.component_type === 'Input') {
                            const found = masterInputs.find((m: any) => normalize(m.input_name) === normalize(item.component_name));
                            if (found) rate = val(found.unit_cost);
                        } else {
                            const found = masterPackaging.find((m: any) => normalize(m.material_name) === normalize(item.component_name));
                            if (found) rate = val(found.unit_cost);
                        }

                        const consumption = val(item.consumption_per_unit);
                        const scrap = val(item.scrap_percent);
                        const lineCost = consumption * rate * (1 + (scrap / 100));

                        updateIfChanged(`products[${idx}].product_bom[${bIdx}].calculated_cost_contribution`, lineCost, true);
                        unitMaterialCost += lineCost;
                    });

                    updateIfChanged(`products[${idx}].unit_material_cost`, unitMaterialCost, true);

                    unitVarCost = unitMaterialCost +
                        val(p.qc_testing_cost_per_unit) +
                        val(p.other_variable_cost_per_unit);
                }

                // Update Final Unit Variable Cost
                updateIfChanged(`products[${idx}].unit_variable_cost`, unitVarCost, true);


                // ============================================
                // D. REVENUE & TOTALS
                // ============================================
                let sellingPrice = val(p.domestic_selling_price_per_unit);

                if (p.target_market === 'Export') {
                    sellingPrice = val(p.export_selling_price_per_unit) * val(fxRate);
                }

                const discount = val(p.expected_discount_or_commission_percent);
                const netPrice = sellingPrice * (1 - (discount / 100));

                const monthlyRev = grossUnits * netPrice;
                const monthlyCOGS = grossUnits * unitVarCost;

                updateIfChanged(`products[${idx}].monthly_revenue_sku`, monthlyRev, false);
                updateIfChanged(`products[${idx}].monthly_cogs_sku`, monthlyCOGS, false);

                totalRev += monthlyRev;
                totalCOGS += monthlyCOGS;
            });

            // ============================================
            // GLOBAL TOTALS
            // ============================================
            updateIfChanged('monthly_revenue_total', totalRev, false);
            updateIfChanged('monthly_cogs_total', totalCOGS, false);
            updateIfChanged('monthly_gross_profit', totalRev - totalCOGS, false);

        });
        return () => subscription.unsubscribe();
    }, [watch, setValue, getValues]);

    // ============================================
    // SECTION 9: EXPORT LOGISTICS CALCULATIONS
    // ============================================
    useEffect(() => {
        const calculateExportLogistics = () => {
            // Helper to get safe numbers
            const val = (path: string) => Number(getValues(path) || 0);

            const exportingEnabled = getValues('exporting_enabled');

            let monthlyExportLogisticsCost = 0;

            if (exportingEnabled) {
                const frequency = val('shipment_frequency_per_month');
                const orderSize = val('avg_export_order_size_kg');
                const freightRate = val('freight_cost_per_kg_or_container');
                const insurance = val('insurance_cost_monthly');
                const clearingRate = val('clearing_forwarding_cost_per_shipment');

                // Estimated Export Quantity (Monthly) = Frequency * Order Size
                const estimatedExportQty = frequency * orderSize;

                // Formula: (estimated_export_qty * freight) + insurance + clearing
                // Note: Clearing is per shipment, so Monthly Clearing = Frequency * Clearing Rate
                const freightCost = estimatedExportQty * freightRate;
                const clearingCost = frequency * clearingRate;

                monthlyExportLogisticsCost = freightCost + insurance + clearingCost;
            }

            // Update the field if changed (with circuit breaker)
            const currentCost = val('monthly_export_logistics_cost');
            if (Math.abs(currentCost - monthlyExportLogisticsCost) > 0.5) {
                setValue('monthly_export_logistics_cost', Math.round(monthlyExportLogisticsCost), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
            }
        };

        // 1. Run immediately on mount
        calculateExportLogistics();

        // 2. Subscribe to changes
        const subscription = watch((value, { name, type }) => {
            const triggers = [
                'exporting_enabled',
                'shipment_frequency_per_month',
                'avg_export_order_size_kg',
                'freight_cost_per_kg_or_container',
                'insurance_cost_monthly',
                'clearing_forwarding_cost_per_shipment'
            ];

            // Trigger if bulk load (!name) OR if relevant trigger
            if (!name || triggers.some(t => name.includes(t))) {
                // Avoid infinite loops if we are just updating a calculated field
                if (name === 'monthly_export_logistics_cost') return;

                calculateExportLogistics();
            }
        });

        return () => subscription.unsubscribe();
    }, [watch, setValue, getValues]);
    // // 3. Capex Totals
    // ============================================
    // SECTION 10: CAPEX CALCULATIONS
    // ============================================
    useEffect(() => {
        const calculateCapex = () => {
            // Helper to safe update
            const updateIfChanged = (path: any, newVal: number) => {
                const currentVal = Number(getValues(path) || 0);
                // Comparison circuit breaker
                if (Math.abs(currentVal - newVal) > 0.5) {
                    setValue(path, Math.round(newVal), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                }
            };

            const allValues = getValues();
            const capexItems = allValues.capex_items || [];
            let capexSubtotal = 0;

            // 1. Calculate Row Totals and Subtotal
            capexItems.forEach((item: any, idx: number) => {
                const qty = Number(item.quantity || 0);
                const rate = Number(item.rate_per_unit || 0);
                const rowTotal = qty * rate;

                // Update row total
                updateIfChanged(`capex_items[${idx}].total_cost`, rowTotal);

                capexSubtotal += rowTotal;
            });

            // Update Capex Subtotal
            updateIfChanged('capex_subtotal', capexSubtotal);

            // 2. Calculate Contingency
            const contingencyPercent = Number(allValues.contingency_percent || 0);
            const contingencyAmount = capexSubtotal * (contingencyPercent / 100);
            updateIfChanged('contingency_amount', contingencyAmount);

            // 3. Calculate Total Capex
            const preOpCost = Number(allValues.preoperating_cost_lump_sum || 0);
            const totalCapex = capexSubtotal + contingencyAmount + preOpCost;

            updateIfChanged('total_capex', totalCapex);
        };

        // 1. Run immediately on mount
        calculateCapex();

        // 2. Subscribe to changes
        const subscription = watch((value, { name, type }) => {
            const triggers = [
                'capex_items',
                'preoperating_cost_lump_sum',
                'contingency_percent'
            ];

            // Trigger if bulk load (!name) OR if relevant trigger
            if (!name || triggers.some(t => name.includes(t))) {
                // Avoid infinite loops if we are just updating a calculated field
                if (name?.includes('total_cost') || name?.includes('contingency_amount') || name?.includes('capex_subtotal') || name === 'total_capex') {
                    return;
                }

                calculateCapex();
            }
        });

        return () => subscription.unsubscribe();
    }, [watch, setValue, getValues]);

    // ============================================
    // SECTION 11: HR & PAYROLL CALCULATIONS
    // ============================================
    // ============================================
    // SECTION 11: HR & PAYROLL CALCULATIONS
    // ============================================
    useEffect(() => {
        const calculatePayroll = () => {
            // Helper to safe update
            const updateIfChanged = (path: any, newVal: number) => {
                const currentVal = Number(getValues(path) || 0);
                if (Math.abs(currentVal - newVal) > 0.5) {
                    setValue(path, Math.round(newVal), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                }
            };

            const staff = getValues('staff') || [];
            let totalPayroll = 0;
            let totalDirectLabor = 0;

            staff.forEach((person: any) => {
                const count = Number(person.count || 0);
                const salary = Number(person.monthly_salary_per_person || 0);
                const cost = count * salary;

                totalPayroll += cost;

                if (person.is_direct_labor) {
                    totalDirectLabor += cost;
                }
            });

            const totalIndirectLabor = totalPayroll - totalDirectLabor;

            updateIfChanged('monthly_payroll_total', totalPayroll);
            updateIfChanged('monthly_direct_labor_total', totalDirectLabor);
            updateIfChanged('monthly_indirect_labor_total', totalIndirectLabor);
        };

        // 1. Run immediately on mount
        calculatePayroll();

        // 2. Subscribe to changes
        const subscription = watch((value, { name, type }) => {
            // Trigger if name includes 'staff' OR if name is undefined (bulk load/reset)
            if (!name || name.includes('staff')) {
                // Avoid infinite loops if we are triggered by the outputs we set
                if (name?.includes('monthly_payroll_total') || name?.includes('monthly_direct_labor_total') || name?.includes('monthly_indirect_labor_total')) return;

                calculatePayroll();
            }
        });

        return () => subscription.unsubscribe();
    }, [watch, setValue, getValues]);

    // ============================================
    // SECTION 12: OPEX & OVERHEADS CALCULATIONS
    // ============================================
    useEffect(() => {
        const calculateOPEX = () => {
            // Helper to get safe numbers
            const val = (path: string) => Number(getValues(path) || 0);

            // 1. Auto-Populate Rent if Rented
            const status = getValues('premises_status');
            const rentFromSec3 = val('rent_per_month');
            const currentRentField = val('rent_monthly');

            let calculatedRent = 0;
            if (status === 'Rented' || status === 'Leased') {
                calculatedRent = rentFromSec3;
            } else {
                // If owned, rent is 0. However, if user manually entered something in rent_monthly
                // while status is Owned, we might want to respect it? 
                // But the requirement says "is not updating... when i change Rent Per Month".
                // Usually if status is Owned, calculation shouldn't override manual input unless we strictly enforce 0.
                // For safety and consistency with "Auto-populate", we strictly set it to 0 or Sec3 rent.
                calculatedRent = 0;
                // Actually, if status is Owned, we probably shouldn't be overwriting rent_monthly if the user wants to put a notional rent?
                // But the previous logic imply a strict link: "newRent = rentFromSec3" if rented.
                // If not rented, it didn't touch it in the previous code?
                // Original code: if (status === 'Rented' || status === 'Leased') { newRent = rentFromSec3; }
                // It only updated if rented/leased. If Owned, it did nothing?
                // Wait, "let newRent = 0; if (Rented) newRent = rentFromSec3".
                // Then check absolute diff.
                // So if Owned, newRent was 0. So it WAS forcing 0 if Owned.
            }

            // Sync Rent Field
            if (Math.abs(currentRentField - calculatedRent) > 0.5) {
                setValue('rent_monthly', Math.round(calculatedRent), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
            }

            // 2. Sum all simple overheads
            // Use calculatedRent variable to ensure we use the latest value
            const overheadsSum = val('electricity_cost_monthly') +
                val('water_cost_monthly') +
                val('fuel_transport_monthly') +
                val('maintenance_cost_monthly') +
                calculatedRent + // Use the fresh value
                val('admin_expenses_monthly') +
                val('sales_marketing_monthly') +
                val('qc_lab_consumables_monthly') +
                val('export_marketing_cost_monthly') +
                val('misc_monthly');

            // Add Indirect Labor
            const indirectLabor = val('monthly_indirect_labor_total');

            const totalOverheads = overheadsSum + indirectLabor;
            const currentTotal = val('monthly_overheads_total');

            if (Math.abs(currentTotal - totalOverheads) > 0.5) {
                setValue('monthly_overheads_total', Math.round(totalOverheads), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
            }
        };

        // 1. Run immediately on mount
        calculateOPEX();

        // 2. Subscribe to changes
        const subscription = watch((value, { name, type }) => {
            const triggers = [
                // Section 3 Triggers
                'premises_status',
                'rent_per_month',
                // Section 12 Triggers
                'electricity_cost_monthly',
                'water_cost_monthly',
                'fuel_transport_monthly',
                'maintenance_cost_monthly',
                'rent_monthly',
                'admin_expenses_monthly',
                'sales_marketing_monthly',
                'qc_lab_consumables_monthly',
                'export_marketing_cost_monthly',
                'misc_monthly',
                'monthly_indirect_labor_total'
            ];

            // Trigger if bulk load (!name) OR if relevant trigger
            if (!name || triggers.some(t => name.includes(t))) {
                // Avoid infinite loops if we are just updating a calculated field
                if (name === 'monthly_overheads_total') return;
                // If name is rent_monthly, we technically triggered it ourselves, but we need to re-calc total?
                // But calculateOPEX calculates both.
                // If we update rent_monthly, watch fires 'rent_monthly'.
                // calculateOPEX will run again, calculatedRent will be same, setValue skipped.
                // totalOverheads will be calculated. setValue skipped if same.
                // So loop is safe.

                calculateOPEX();
            }
        });

        return () => subscription.unsubscribe();
    }, [watch, setValue, getValues]);



    // ============================================
    // SECTION 13: FINANCIALS & PROFITABILITY (AUTO)
    // ============================================
    useEffect(() => {
        const subscription = watch((value, { name, type }) => {
            // Guard clause: only run on changes or undefined (initial load)
            if (type !== 'change' && type !== undefined) return;

            // Trigger fields (Products, Overheads, Logistics)
            const triggers = [
                'products',
                'monthly_overheads_total',
                'monthly_export_logistics_cost',
                'exporting_enabled'
            ];

            // If the change wasn't in one of our relevant fields
            if (!triggers.some(t => name?.includes(t))) return;

            // Avoid loops from self-updates
            if (name?.includes('monthly_revenue_sku') ||
                name?.includes('monthly_cogs_sku') ||
                name?.includes('monthly_gross_profit') ||
                name?.includes('monthly_net_profit_before_finance')) {
                return;
            }

            // Helper to safe update
            const updateIfChanged = (path: any, newVal: number) => {
                const currentVal = Number(getValues(path) || 0);
                if (Math.abs(currentVal - newVal) > 0.5) {
                    setValue(path, Math.round(newVal), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                }
            };

            const val = (path: string) => Number(getValues(path) || 0);
            const products = getValues('products') || [];
            const exportingEnabled = getValues('exporting_enabled');

            let totalRevenue = 0;
            let totalCOGS = 0;

            // 1. Calculate SKU Level Financials
            products.forEach((p: any, idx: number) => {
                const capacity = Number(p.installed_capacity_per_month || 0);
                const utilization = Number(p.year1_capacity_utilization_percent || 0);
                // gross_units = capacity * (utilization / 100)
                const grossUnits = capacity * (utilization / 100);
                const goodUnits = grossUnits; // Assuming 0 reject for now as per simple request

                // Determine Selling Price (Simple logic: prioritize domestic, fallback to export if enabled/present)
                // Note: User prompt implies a single "selling_price_per_unit" logic.
                // We will use 'domestic_selling_price_per_unit' as standard.
                let sellingPrice = Number(p.domestic_selling_price_per_unit || 0);
                if (exportingEnabled && (!sellingPrice || sellingPrice === 0)) {
                    // Fallback to export price logic if needed, but keeping it simple for now
                    // assuming domestic price is the base "ex-factory" price or similar.
                    // If user specifically wanted export price usage, we might need more complex logic.
                }

                const unitVarCost = Number(p.unit_variable_cost || 0);

                const revenueSku = goodUnits * sellingPrice;
                const cogsSku = goodUnits * unitVarCost;

                totalRevenue += revenueSku;
                totalCOGS += cogsSku;

                // Update SKU fields
                updateIfChanged(`products[${idx}].gross_units`, grossUnits);
                updateIfChanged(`products[${idx}].good_units`, goodUnits);
                updateIfChanged(`products[${idx}].monthly_revenue_sku`, revenueSku);
                updateIfChanged(`products[${idx}].monthly_cogs_sku`, cogsSku);
            });

            // 2. Global Totals
            const grossProfit = totalRevenue - totalCOGS;

            const overheads = val('monthly_overheads_total');
            const exportLogistics = val('monthly_export_logistics_cost');

            const netProfit = grossProfit - overheads - exportLogistics;

            updateIfChanged('monthly_revenue_total', totalRevenue);
            updateIfChanged('monthly_cogs_total', totalCOGS);
            updateIfChanged('monthly_gross_profit', grossProfit);
            updateIfChanged('monthly_net_profit_before_finance', netProfit);
        });

        return () => subscription.unsubscribe();
    }, [watch, setValue, getValues]);

    // ============================================
    // SECTION 14: WORKING CAPITAL CALCULATIONS
    // ============================================
    useEffect(() => {
        const subscription = watch((value, { name, type }) => {
            if (type !== 'change' && type !== undefined) return;

            const triggers = [
                'monthly_cogs_total',
                'monthly_revenue_total',
                'monthly_overheads_total',
                'raw_material_inventory_days',
                'packaging_inventory_days',
                'finished_goods_inventory_days',
                'domestic_receivables_days',
                'export_receivables_days',
                'payables_days',
                'cash_buffer_days',
                'products',
                'exporting_enabled'
            ];

            if (!triggers.some(t => name?.includes(t))) return;

            // Avoid loops
            if (name?.includes('working_capital_required') || name?.includes('inventory_investment')) return;

            const updateIfChanged = (path: any, newVal: number) => {
                const currentVal = Number(getValues(path) || 0);
                if (Math.abs(currentVal - newVal) > 0.5) {
                    setValue(path, Math.round(newVal), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                }
            };

            const val = (path: string) => Number(getValues(path) || 0);
            const exportingEnabled = getValues('exporting_enabled');

            // 1. Inputs
            const monthlyCOGS = val('monthly_cogs_total');
            const monthlyRevenue = val('monthly_revenue_total');
            const monthlyOverheads = val('monthly_overheads_total');

            const dayRules = {
                raw: val('raw_material_inventory_days'),
                pack: val('packaging_inventory_days'),
                fg: val('finished_goods_inventory_days'),
                domRec: val('domestic_receivables_days'),
                imgRec: val('export_receivables_days'),
                pay: val('payables_days'),
                cash: val('cash_buffer_days')
            };

            // 2. Basics
            const dailyCOGS = monthlyCOGS / 30;
            const dailySales = monthlyRevenue / 30;

            // 3. Inventory Investment
            const inventoryDaysTotal = dayRules.raw + dayRules.pack + dayRules.fg;
            const inventoryInvestment = dailyCOGS * inventoryDaysTotal;

            // 4. Receivables (Weighted)
            let weightedDays = dayRules.domRec;
            if (exportingEnabled) {
                // Determine weighted days simply by averaging for now
                if (dayRules.imgRec > 0) {
                    weightedDays = (dayRules.domRec + dayRules.imgRec) / 2;
                }
            }
            const receivablesInvestment = dailySales * weightedDays;

            // 5. Payables
            const payablesCredit = dailyCOGS * dayRules.pay;

            // 6. Cash Buffer
            const cashBuffer = (monthlyOverheads / 30) * dayRules.cash;

            // 7. Total WC
            const wcRequired = inventoryInvestment + receivablesInvestment + cashBuffer - payablesCredit;

            updateIfChanged('inventory_investment', inventoryInvestment);
            updateIfChanged('receivables_investment', receivablesInvestment);
            updateIfChanged('payables_credit', payablesCredit);
            updateIfChanged('cash_buffer', cashBuffer);
            updateIfChanged('working_capital_required', wcRequired);
        });

        return () => subscription.unsubscribe();
    }, [watch, setValue, getValues]);

    // ============================================
    // SECTION 15: FINANCING CALCULATIONS
    // ============================================
    // ============================================
    // SECTION 15: FINANCING CALCULATIONS
    // ============================================
    // 12. Financing & Loan Terms (Loop-Free)
    useEffect(() => {
        const subscription = watch((formValues, { name }) => {
            // 1. Safety Check
            if (!name || !formValues) return;

            // 2. Define Inputs (Only these should trigger a calculation)
            const financeInputs = [
                'tenor_years',
                'loan_amount_requested',
                'markup_rate_percent',
                'owner_equity_contribution',
                'grace_period_months' // Added from your layout
            ];

            // 3. THE FIX: Guard Clause
            // If the changed field is NOT in our input list, stop immediately.
            // This prevents the loop when 'num_installments' or 'installment_amount' is updated.
            if (!financeInputs.includes(name)) {
                return;
            }

            // 4. Extract Values
            const tenorYears = Number(formValues.tenor_years || 0);
            const loanAmount = Number(formValues.loan_amount_requested || 0);
            const graceMonths = Number(formValues.grace_period_months || 0);

            // 5. Calculate
            const totalMonths = tenorYears * 12;

            // Calculate active repayment months (Total - Grace)
            // Ensure we don't have negative months
            const repaymentMonths = Math.max(0, totalMonths - graceMonths);

            let monthlyInstallment = 0;

            // Simple Calculation (Loan / Repayment Months)
            if (repaymentMonths > 0) {
                monthlyInstallment = loanAmount / repaymentMonths;
            }

            // 6. Update Outputs
            // { shouldValidate: false } ensures we don't trigger unnecessary re-renders
            setValue('num_installments', repaymentMonths, { shouldValidate: false });
            setValue('installment_amount', Math.round(monthlyInstallment), { shouldValidate: false });
        });

        return () => subscription.unsubscribe();
    }, [watch, setValue]);

    return null;
};const Test5 = () => {
    const [showexceededQuotaPopup, setShowexceededQuotaPopup] = React.useState<boolean>(false);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const mutation = useMutation({
        mutationKey: ['submitPinkSaltFeasibility'],
        mutationFn: async ({ formData }: { formData: any }) => {
            const { data } = await api.post(`/generate-pink-salt-feasibility`, {
                case_details: JSON.stringify(formData),
                draft_type_id: '45'
            }, {
                headers: { Authorization: `bearer ${localStorage.getItem("pakLawAssistToken")}` },
            });
            return data;
        },
        onError: (error: AxiosError) => {
            if (error?.status === 403) setShowexceededQuotaPopup(true);
            if (error?.status === 401) {
                localStorage.removeItem('pakLawAssistToken');
                window.location.replace('/sign-in');
            }
        },
        onSuccess: (data: any) => {
            dispatch(usageDataActions.addDraft());
            navigate(`/${data.source}/${data.draft_master_id}`);
        },
    });

    return (
        <div className='w-full my-5'>
            <DynamicForm
                formConfig={pinkSaltFormConfig}
                onSubmit={(data) => mutation.mutate({ formData: data })}
                isPending={mutation.isPending}
                showexceededQuotaPopup={showexceededQuotaPopup}
                setShowexceededQuotaPopup={setShowexceededQuotaPopup}
            >
                <PinkSaltCalculations />
            </DynamicForm>
        </div>
    )
}

export default Test5;