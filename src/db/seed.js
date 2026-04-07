/**
 * seed.js — Final production-grade seed script for Supabase (PostgreSQL)
 *
 * Root cause fix applied throughout:
 *   Every INSERT uses a SINGLE ROW per query call.
 *   This permanently eliminates "could not determine data type of parameter $N"
 *   errors caused by pg's inability to infer types when mixing inline literals
 *   and $N params across multiple rows in one VALUES clause.
 *
 * All NULLs inlined with explicit type casts (NULL::uuid, NULL::text, etc.)
 * All UUIDs are fixed constants — fully idempotent across runs.
 *
 * Usage:
 *   1. Ensure DATABASE_URL is set in .env
 *   2. npm run seed
 */

import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";

const { Client } = pg;

// ─── Fixed UUIDs ──────────────────────────────────────────────────────────────

const IDS = {
  roles: {
    partner:             "11111111-1111-1111-1111-000000000001",
    stateController:     "11111111-1111-1111-1111-000000000002",
    teamLead:            "11111111-1111-1111-1111-000000000003",
    charteredAccountant: "11111111-1111-1111-1111-000000000004",
    nonUlbExecutive:     "11111111-1111-1111-1111-000000000005",
    ulbExecutive:        "11111111-1111-1111-1111-000000000006",
  },
  users: {
    sahil: "22222222-2222-2222-2222-000000000001",
    om:    "22222222-2222-2222-2222-000000000002",
  },
  contractTypes: {
    manpower: "33333333-3333-3333-3333-000000000001",
    civil:    "33333333-3333-3333-3333-000000000002",
  },
  suppliers: {
    techStaffing: "44444444-4444-4444-4444-000000000001",
    buildCorp:    "44444444-4444-4444-4444-000000000002",
  },
  ulbs: {
    bilaspur: "55555555-5555-5555-5555-000000000001",
    korba:    "55555555-5555-5555-5555-000000000002",
  },
  teams: {
    alphaAudit: "66666666-6666-6666-6666-000000000001",
    betaReview: "66666666-6666-6666-6666-000000000002",
  },
  teamMembers: {
    sahilAlpha: "77777777-7777-7777-7777-000000000001",
    omAlpha:    "77777777-7777-7777-7777-000000000002",
    sahilBeta:  "77777777-7777-7777-7777-000000000003",
  },
  ulbTeamAssignments: {
    bilaspurAlpha: "88888888-8888-8888-8888-000000000001",
    korbaAlpha:    "88888888-8888-8888-8888-000000000002",
    korbaBeta:     "88888888-8888-8888-8888-000000000003",
  },
  checklistTemplates: {
    manpowerV1: "99999999-9999-9999-9999-000000000001",
  },
  files: {
    file1: "aaaaaaaa-aaaa-aaaa-aaaa-000000000001",
    file2: "aaaaaaaa-aaaa-aaaa-aaaa-000000000002",
  },
  checklists: {
    file1Phase1: "bbbbbbbb-bbbb-bbbb-bbbb-000000000001",
    file2Phase1: "bbbbbbbb-bbbb-bbbb-bbbb-000000000002",
  },
  queries: {
    query1: "cccccccc-cccc-cccc-cccc-000000000001",
    query2: "cccccccc-cccc-cccc-cccc-000000000002",
  },
  queryReplies: {
    reply1: "dddddddd-dddd-dddd-dddd-000000000001",
    reply2: "dddddddd-dddd-dddd-dddd-000000000002",
    reply3: "dddddddd-dddd-dddd-dddd-000000000003",
  },
  queryParticipants: {
    p1: "eeeeeeee-eeee-eeee-eeee-000000000001",
    p2: "eeeeeeee-eeee-eeee-eeee-000000000002",
  },
  queryActivityLog: {
    log1: "ffffffff-ffff-ffff-ffff-000000000001",
    log2: "ffffffff-ffff-ffff-ffff-000000000002",
    log3: "ffffffff-ffff-ffff-ffff-000000000003",
    log4: "ffffffff-ffff-ffff-ffff-000000000004",
  },
  queryAttachments: {
    qa1: "a0a0a0a0-a0a0-a0a0-a0a0-000000000001",
  },
  fileVersionHistory: {
    fvh1: "b1b1b1b1-b1b1-b1b1-b1b1-000000000001",
  },
  fileVersionChanges: {
    fvc1: "c2c2c2c2-c2c2-c2c2-c2c2-000000000001",
    fvc2: "c2c2c2c2-c2c2-c2c2-c2c2-000000000002",
  },
  attachments: {
    att1: "d3d3d3d3-d3d3-d3d3-d3d3-000000000001",
  },
};

const Q = {
  s1_gem_item_availability:      "e4e4e4e4-e4e4-e4e4-e4e4-000000000001",
  s1_gem_mode_of_purchase:       "e4e4e4e4-e4e4-e4e4-e4e4-000000000002",
  s1_quotation_ref_no:           "e4e4e4e4-e4e4-e4e4-e4e4-000000000003",
  s1_quotation_date:             "e4e4e4e4-e4e4-e4e4-e4e4-000000000004",
  s1_quotation_details:          "e4e4e4e4-e4e4-e4e4-e4e4-000000000005",
  s1_tender_no:                  "e4e4e4e4-e4e4-e4e4-e4e4-000000000006",
  s1_tender_date:                "e4e4e4e4-e4e4-e4e4-e4e4-000000000007",
  s1_tender_details:             "e4e4e4e4-e4e4-e4e4-e4e4-000000000008",
  s1_estimated_amount:           "e4e4e4e4-e4e4-e4e4-e4e4-000000000009",
  s1_source_of_fund:             "e4e4e4e4-e4e4-e4e4-e4e4-000000000010",
  s1_financial_approval:         "e4e4e4e4-e4e4-e4e4-e4e4-000000000011",
  s1_fa_approval_number:         "e4e4e4e4-e4e4-e4e4-e4e4-000000000012",
  s1_fa_approval_date:           "e4e4e4e4-e4e4-e4e4-e4e4-000000000013",
  s1_fa_approved_value:          "e4e4e4e4-e4e4-e4e4-e4e4-000000000014",
  s1_fa_name_of_approver:        "e4e4e4e4-e4e4-e4e4-e4e4-000000000015",
  s1_fa_authority_of_approver:   "e4e4e4e4-e4e4-e4e4-e4e4-000000000016",
  s1_tender_published:           "e4e4e4e4-e4e4-e4e4-e4e4-000000000017",
  s1_tp_publication_date:        "e4e4e4e4-e4e4-e4e4-e4e4-000000000018",
  s1_tp_newspapers:              "e4e4e4e4-e4e4-e4e4-e4e4-000000000019",
  s1_tender_committee_approval:  "e4e4e4e4-e4e4-e4e4-e4e4-000000000020",
  s1_tca_approval_number:        "e4e4e4e4-e4e4-e4e4-e4e4-000000000021",
  s1_tca_approval_date:          "e4e4e4e4-e4e4-e4e4-e4e4-000000000022",
  s1_tca_approved_value:         "e4e4e4e4-e4e4-e4e4-e4e4-000000000023",
  s1_tca_name_of_approver:       "e4e4e4e4-e4e4-e4e4-e4e4-000000000024",
  s1_tca_authority_of_approver:  "e4e4e4e4-e4e4-e4e4-e4e4-000000000025",
  s2_supply_order_available:     "f5f5f5f5-f5f5-f5f5-f5f5-000000000001",
  s2_so_number:                  "f5f5f5f5-f5f5-f5f5-f5f5-000000000002",
  s2_so_date:                    "f5f5f5f5-f5f5-f5f5-f5f5-000000000003",
  s2_so_date_as_per_po:          "f5f5f5f5-f5f5-f5f5-f5f5-000000000004",
  s2_so_actual_date_of_supply:   "f5f5f5f5-f5f5-f5f5-f5f5-000000000005",
  s2_so_extended_date_required:  "f5f5f5f5-f5f5-f5f5-f5f5-000000000006",
  s3_attendance_verified:        "16161616-1616-1616-1616-000000000001",
  s3_epf_esic_paid:              "16161616-1616-1616-1616-000000000002",
  s4_bill_type:                  "27272727-2727-2727-2727-000000000001",
  s4_bill_number:                "27272727-2727-2727-2727-000000000002",
  s4_bill_amount:                "27272727-2727-2727-2727-000000000003",
  s4_amount_sanctioned:          "27272727-2727-2727-2727-000000000004",
  s4_payment_till_date:          "27272727-2727-2727-2727-000000000005",
  s4_gross_amount:               "27272727-2727-2727-2727-000000000006",
  s4_security_deposit:           "27272727-2727-2727-2727-000000000007",
  s4_income_tax:                 "27272727-2727-2727-2727-000000000008",
  s4_penalty_ld:                 "27272727-2727-2727-2727-000000000009",
  s4_advance_adjusted:           "27272727-2727-2727-2727-000000000010",
  s4_under_over_payment:         "27272727-2727-2727-2727-000000000011",
  s4_difference_amount:          "27272727-2727-2727-2727-000000000012",
  s5_attendance_system_proper:   "38383838-3838-3838-3838-000000000001",
  s5_comparative_statements:     "38383838-3838-3838-3838-000000000002",
  s5_agreements_po_tender:       "38383838-3838-3838-3838-000000000003",
  s5_earnest_money:              "38383838-3838-3838-3838-000000000004",
  s5_small_scale_industries:     "38383838-3838-3838-3838-000000000005",
  s5_plant_machinery_dga:        "38383838-3838-3838-3838-000000000006",
  s5_payment_within_20_days:     "38383838-3838-3838-3838-000000000007",
  s5_late_payment_interest:      "38383838-3838-3838-3838-000000000008",
  s5_excel_calculation:          "38383838-3838-3838-3838-000000000009",
  s6_book_attendance_register:   "49494949-4949-4949-4949-000000000001",
  s6_book_cheque_issue_register: "49494949-4949-4949-4949-000000000002",
  s6_book_cash_book:             "49494949-4949-4949-4949-000000000003",
  s6_book_work_file:             "49494949-4949-4949-4949-000000000004",
  s6_book_grant_register:        "49494949-4949-4949-4949-000000000005",
  s6_sup_invoice:                "49494949-4949-4949-4949-000000000006",
  s6_sup_attendance_register:    "49494949-4949-4949-4949-000000000007",
  s6_sup_labour_license:         "49494949-4949-4949-4949-000000000008",
  s6_sup_epf_esic_challan:       "49494949-4949-4949-4949-000000000009",
  s6_sup_payment_confirmation:   "49494949-4949-4949-4949-000000000010",
  s6_sup_bank_statement:         "49494949-4949-4949-4949-000000000011",
};

const CR = {
  s1_gem_item_availability:      "50505050-5050-5050-5050-000000000001",
  s1_gem_mode_of_purchase:       "50505050-5050-5050-5050-000000000002",
  s1_tender_no:                  "50505050-5050-5050-5050-000000000003",
  s1_tender_date:                "50505050-5050-5050-5050-000000000004",
  s1_tender_details:             "50505050-5050-5050-5050-000000000005",
  s1_estimated_amount:           "50505050-5050-5050-5050-000000000006",
  s1_source_of_fund:             "50505050-5050-5050-5050-000000000007",
  s1_financial_approval:         "50505050-5050-5050-5050-000000000008",
  s1_fa_approval_number:         "50505050-5050-5050-5050-000000000009",
  s1_fa_approval_date:           "50505050-5050-5050-5050-000000000010",
  s1_fa_approved_value:          "50505050-5050-5050-5050-000000000011",
  s1_fa_name_of_approver:        "50505050-5050-5050-5050-000000000012",
  s1_fa_authority_of_approver:   "50505050-5050-5050-5050-000000000013",
  s1_tender_published:           "50505050-5050-5050-5050-000000000014",
  s1_tp_publication_date:        "50505050-5050-5050-5050-000000000015",
  s1_tp_newspapers:              "50505050-5050-5050-5050-000000000016",
  s1_tender_committee_approval:  "50505050-5050-5050-5050-000000000017",
  s1_tca_approval_number:        "50505050-5050-5050-5050-000000000018",
  s1_tca_approval_date:          "50505050-5050-5050-5050-000000000019",
  s1_tca_approved_value:         "50505050-5050-5050-5050-000000000020",
  s1_tca_name_of_approver:       "50505050-5050-5050-5050-000000000021",
  s1_tca_authority_of_approver:  "50505050-5050-5050-5050-000000000022",
  s2_supply_order_available:     "50505050-5050-5050-5050-000000000023",
  s2_so_number:                  "50505050-5050-5050-5050-000000000024",
  s2_so_date:                    "50505050-5050-5050-5050-000000000025",
  s2_so_date_as_per_po:          "50505050-5050-5050-5050-000000000026",
  s2_so_actual_date_of_supply:   "50505050-5050-5050-5050-000000000027",
  s2_so_extended_date_required:  "50505050-5050-5050-5050-000000000028",
  s3_attendance_verified:        "50505050-5050-5050-5050-000000000029",
  s3_epf_esic_paid:              "50505050-5050-5050-5050-000000000030",
  s4_bill_type:                  "50505050-5050-5050-5050-000000000031",
  s4_bill_number:                "50505050-5050-5050-5050-000000000032",
  s4_bill_amount:                "50505050-5050-5050-5050-000000000033",
  s4_amount_sanctioned:          "50505050-5050-5050-5050-000000000034",
  s4_payment_till_date:          "50505050-5050-5050-5050-000000000035",
  s4_gross_amount:               "50505050-5050-5050-5050-000000000036",
  s4_security_deposit:           "50505050-5050-5050-5050-000000000037",
  s4_income_tax:                 "50505050-5050-5050-5050-000000000038",
  s4_penalty_ld:                 "50505050-5050-5050-5050-000000000039",
  s4_advance_adjusted:           "50505050-5050-5050-5050-000000000040",
  s4_under_over_payment:         "50505050-5050-5050-5050-000000000041",
  s4_difference_amount:          "50505050-5050-5050-5050-000000000042",
  s5_attendance_system_proper:   "50505050-5050-5050-5050-000000000043",
  s5_comparative_statements:     "50505050-5050-5050-5050-000000000044",
  s5_agreements_po_tender:       "50505050-5050-5050-5050-000000000045",
  s5_earnest_money:              "50505050-5050-5050-5050-000000000046",
  s5_small_scale_industries:     "50505050-5050-5050-5050-000000000047",
  s5_plant_machinery_dga:        "50505050-5050-5050-5050-000000000048",
  s5_payment_within_20_days:     "50505050-5050-5050-5050-000000000049",
  s5_late_payment_interest:      "50505050-5050-5050-5050-000000000050",
  s5_excel_calculation:          "50505050-5050-5050-5050-000000000051",
  s6_book_attendance_register:   "50505050-5050-5050-5050-000000000052",
  s6_book_cheque_issue_register: "50505050-5050-5050-5050-000000000053",
  s6_book_cash_book:             "50505050-5050-5050-5050-000000000054",
  s6_book_work_file:             "50505050-5050-5050-5050-000000000055",
  s6_book_grant_register:        "50505050-5050-5050-5050-000000000056",
  s6_sup_invoice:                "50505050-5050-5050-5050-000000000057",
  s6_sup_attendance_register:    "50505050-5050-5050-5050-000000000058",
  s6_sup_labour_license:         "50505050-5050-5050-5050-000000000059",
  s6_sup_epf_esic_challan:       "50505050-5050-5050-5050-000000000060",
  s6_sup_payment_confirmation:   "50505050-5050-5050-5050-000000000061",
  s6_sup_bank_statement:         "50505050-5050-5050-5050-000000000062",
};

// ─── Helper: single-row insert ────────────────────────────────────────────────
// Every INSERT in this script uses one row per call.
// This is the permanent fix for pg's type inference limitation.

async function insert(client, sql, params) {
  await client.query(sql + " ON CONFLICT DO NOTHING", params);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("✅ Connected to database");

  try {
    await client.query("BEGIN");
    console.log("🔄 Transaction started");

    // ── TIER 0: roles ──────────────────────────────────────────────────────────
    console.log("⏳ Seeding roles...");
    const roles = [
      [IDS.roles.partner,             "Partner",              "PARTNER",      1, "Top-level partner role"                   ],
      [IDS.roles.stateController,     "State Controller",     "STATE_CTRL",   2, "State-level controller role"              ],
      [IDS.roles.teamLead,            "Team Lead",            "TEAM_LEAD",    3, "Leads an audit team"                      ],
      [IDS.roles.charteredAccountant, "Chartered Accountant", "CA",           4, "Chartered accountant reviewer"            ],
      [IDS.roles.nonUlbExecutive,     "Non Ulb Executive",    "NON_ULB_EXEC", 5, "Executive not assigned to a specific ULB" ],
      [IDS.roles.ulbExecutive,        "Ulb Executive",        "ULB_EXEC",     6, "Executive assigned to a specific ULB"    ],
    ];
    for (const [id, name, code, level, desc] of roles) {
      await insert(client,
        `INSERT INTO roles (id, name, code, hierarchy_level, description, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [id, name, code, level, desc]
      );
    }

    // ── TIER 0: suppliers ──────────────────────────────────────────────────────
    console.log("⏳ Seeding suppliers...");
    await insert(client,
      `INSERT INTO suppliers (id, supplier_name, pan, gst_no, epf_registration_no, esic_registration_no, labour_licence_no, department_name, file_no, fund_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [IDS.suppliers.techStaffing, "TechStaffing Solutions Pvt Ltd", "AABCT1234C", "22AABCT1234C1Z5",
       "MH/BAN/12345", "MH/BAN/67890", "LL/MH/001/2023", "Public Works Department", "PWD/MPS/001", "14th Finance Commission"]
    );
    await insert(client,
      `INSERT INTO suppliers (id, supplier_name, pan, gst_no, epf_registration_no, esic_registration_no, labour_licence_no, department_name, file_no, fund_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [IDS.suppliers.buildCorp, "BuildCorp Infrastructure Ltd", "AABCB5678D", "22AABCB5678D1Z3",
       "MH/BAN/54321", "MH/BAN/09876", "LL/MH/002/2023", "Civil Engineering Dept", "CED/CIV/002", "State Finance Grant"]
    );

    // ── TIER 1: users ──────────────────────────────────────────────────────────
    console.log("⏳ Seeding users...");
    const sahilHash = await bcrypt.hash("Sahil@123", 10);
    const omHash    = await bcrypt.hash("Om@123",    10);

    await insert(client,
      `INSERT INTO users (id, email, password_hash, name, phone, approve, role_id, is_active, is_deleted, email_verified_at, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, true, $6, true, false, NOW(), NULL::uuid, NULL::uuid)`,
      [IDS.users.sahil, "mankars081@gmail.com", sahilHash, "Sahil", "9876543210", IDS.roles.stateController]
    );
    await insert(client,
      `INSERT INTO users (id, email, password_hash, name, phone, approve, role_id, is_active, is_deleted, email_verified_at, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, true, $6, true, false, NOW(), NULL::uuid, NULL::uuid)`,
      [IDS.users.om, "omkottewar19.04@gmail.com", omHash, "Om", "9876543211", IDS.roles.stateController]
    );

    // ── TIER 1: contract_types ─────────────────────────────────────────────────
    console.log("⏳ Seeding contract_types...");
    await insert(client,
      `INSERT INTO contract_types (id, name, code, is_active, created_by) VALUES ($1, $2, $3, true, $4)`,
      [IDS.contractTypes.manpower, "Manpower", "MPS", IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO contract_types (id, name, code, is_active, created_by) VALUES ($1, $2, $3, true, $4)`,
      [IDS.contractTypes.civil, "Civil", "CIV", IDS.users.sahil]
    );

    // ── TIER 2: teams ──────────────────────────────────────────────────────────
    console.log("⏳ Seeding teams...");
    await insert(client,
      `INSERT INTO teams (id, name, is_deleted, created_by, updated_by) VALUES ($1, $2, false, $3, $3)`,
      [IDS.teams.alphaAudit, "Alpha Audit Team", IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO teams (id, name, is_deleted, created_by, updated_by) VALUES ($1, $2, false, $3, $3)`,
      [IDS.teams.betaReview, "Beta Review Team", IDS.users.om]
    );

    // ── TIER 2: ulbs ──────────────────────────────────────────────────────────
    console.log("⏳ Seeding ulbs...");
    await insert(client,
      `INSERT INTO ulbs (id, name, code, hod_designation, hod_name, district, is_active, is_deleted, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $7)`,
      [IDS.ulbs.bilaspur, "Bilaspur Municipal Corporation", "BLR", "Municipal Commissioner", "Rajesh Kumar Singh", "Bilaspur", IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO ulbs (id, name, code, hod_designation, hod_name, district, is_active, is_deleted, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $7)`,
      [IDS.ulbs.korba, "Korba Municipal Corporation", "KRB", "Municipal Commissioner", "Priya Sharma Agarwal", "Korba", IDS.users.sahil]
    );

    // ── TIER 2: checklist_templates ───────────────────────────────────────────
    console.log("⏳ Seeding checklist_templates...");
    await insert(client,
      `INSERT INTO checklist_templates (id, contract_type_id, name, version, is_active, created_by)
       VALUES ($1, $2, $3, 1, true, $4)`,
      [IDS.checklistTemplates.manpowerV1, IDS.contractTypes.manpower, "Manpower Purchase & Service Checklist", IDS.users.sahil]
    );

    // ── TIER 3: team_members ──────────────────────────────────────────────────
    console.log("⏳ Seeding team_members...");
    await insert(client,
      `INSERT INTO team_members (id, team_id, user_id, joined_at, created_by) VALUES ($1, $2, $3, NOW(), $3)`,
      [IDS.teamMembers.sahilAlpha, IDS.teams.alphaAudit, IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO team_members (id, team_id, user_id, joined_at, created_by) VALUES ($1, $2, $3, NOW(), $4)`,
      [IDS.teamMembers.omAlpha, IDS.teams.alphaAudit, IDS.users.om, IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO team_members (id, team_id, user_id, joined_at, created_by) VALUES ($1, $2, $3, NOW(), $3)`,
      [IDS.teamMembers.sahilBeta, IDS.teams.betaReview, IDS.users.sahil]
    );

    // ── TIER 3: ulb_team_assignments ──────────────────────────────────────────
    console.log("⏳ Seeding ulb_team_assignments...");
    await insert(client,
      `INSERT INTO ulb_team_assignments (id, ulb_id, team_id, assigned_at, created_by) VALUES ($1, $2, $3, NOW(), $4)`,
      [IDS.ulbTeamAssignments.bilaspurAlpha, IDS.ulbs.bilaspur, IDS.teams.alphaAudit, IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO ulb_team_assignments (id, ulb_id, team_id, assigned_at, created_by) VALUES ($1, $2, $3, NOW(), $4)`,
      [IDS.ulbTeamAssignments.korbaAlpha, IDS.ulbs.korba, IDS.teams.alphaAudit, IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO ulb_team_assignments (id, ulb_id, team_id, assigned_at, created_by) VALUES ($1, $2, $3, NOW(), $4)`,
      [IDS.ulbTeamAssignments.korbaBeta, IDS.ulbs.korba, IDS.teams.betaReview, IDS.users.sahil]
    );

    // ── TIER 3: files ─────────────────────────────────────────────────────────
    console.log("⏳ Seeding files...");
    await insert(client,
      `INSERT INTO files (id, file_number, file_title, ulb_id, supplier_id, contract_type_id, officer_name, work_description, amount, risk_flag, status, finalized, finalized_at, finalized_by, ca_observations, is_deleted, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, NULL::timestamptz, NULL::uuid, NULL::text, false, $12, $12)`,
      [IDS.files.file1, "BLR/2025/MPS/0001", "Supply of Sanitation Manpower to Bilaspur Municipal Corporation",
       IDS.ulbs.bilaspur, IDS.suppliers.techStaffing, IDS.contractTypes.manpower,
       "Suresh Patel", "Deployment of 50 sanitation workers for 12 months across all wards",
       "1250000.00", "Medium", "Pre-Audit", IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO files (id, file_number, file_title, ulb_id, supplier_id, contract_type_id, officer_name, work_description, amount, risk_flag, status, finalized, finalized_at, finalized_by, ca_observations, is_deleted, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, NULL::timestamptz, NULL::uuid, NULL::text, false, $12, $12)`,
      [IDS.files.file2, "KRB/2025/MPS/0001", "Security Personnel Services for Korba Municipal Corporation",
       IDS.ulbs.korba, IDS.suppliers.techStaffing, IDS.contractTypes.manpower,
       "Meena Tiwari", "Provision of 20 security guards for municipal buildings and parks",
       "620000.00", "Low", "Under Review", IDS.users.om]
    );

    // ── TIER 3: checklist_template_questions ──────────────────────────────────
    console.log("⏳ Seeding checklist_template_questions...");
    const T = IDS.checklistTemplates.manpowerV1;

    // [key, sec, sectionTitle, num, text, type, cond, pKey, pVal, sort]
    const questions = [
      ["s1_gem_item_availability",     1,"Purchase & Tender","1.1", "Item Availability in GEM",                                                                                               "yes_no",       false, null,                         null,            1 ],
      ["s1_gem_mode_of_purchase",      1,"Purchase & Tender","1.2", "Mode of Purchase",                                                                                                       "text",         false, null,                         null,            2 ],
      ["s1_quotation_ref_no",          1,"Purchase & Tender","1.3", "Quotation Ref. No.",                                                                                                     "text",         true,  "s1_gem_mode_of_purchase",    "By Quotation",  3 ],
      ["s1_quotation_date",            1,"Purchase & Tender","1.4", "Quotation Date",                                                                                                         "text",         true,  "s1_gem_mode_of_purchase",    "By Quotation",  4 ],
      ["s1_quotation_details",         1,"Purchase & Tender","1.5", "Quotation Details",                                                                                                      "text",         true,  "s1_gem_mode_of_purchase",    "By Quotation",  5 ],
      ["s1_tender_no",                 1,"Purchase & Tender","1.6", "Tender No.",                                                                                                             "text",         true,  "s1_gem_mode_of_purchase",    "By Tender",     6 ],
      ["s1_tender_date",               1,"Purchase & Tender","1.7", "Tender Date",                                                                                                            "text",         true,  "s1_gem_mode_of_purchase",    "By Tender",     7 ],
      ["s1_tender_details",            1,"Purchase & Tender","1.8", "Tender Details",                                                                                                         "text",         true,  "s1_gem_mode_of_purchase",    "By Tender",     8 ],
      ["s1_estimated_amount",          1,"Purchase & Tender","1.9", "Estimated Amount (₹)",                                                                                                   "number",       false, null,                         null,            9 ],
      ["s1_source_of_fund",            1,"Purchase & Tender","1.10","Source of Fund",                                                                                                         "text",         false, null,                         null,            10],
      ["s1_financial_approval",        1,"Purchase & Tender","1.11","Financial Approval Available?",                                                                                          "yes_no",       false, null,                         null,            11],
      ["s1_fa_approval_number",        1,"Purchase & Tender","1.12","Approval Number",                                                                                                        "text",         true,  "s1_financial_approval",      "yes",           12],
      ["s1_fa_approval_date",          1,"Purchase & Tender","1.13","Approval Date",                                                                                                          "text",         true,  "s1_financial_approval",      "yes",           13],
      ["s1_fa_approved_value",         1,"Purchase & Tender","1.14","Approved Value (₹)",                                                                                                     "number",       true,  "s1_financial_approval",      "yes",           14],
      ["s1_fa_name_of_approver",       1,"Purchase & Tender","1.15","Name of Approver",                                                                                                       "text",         true,  "s1_financial_approval",      "yes",           15],
      ["s1_fa_authority_of_approver",  1,"Purchase & Tender","1.16","Authority of Approver",                                                                                                  "text",         true,  "s1_financial_approval",      "yes",           16],
      ["s1_tender_published",          1,"Purchase & Tender","1.17","Tender Published?",                                                                                                      "yes_no",       false, null,                         null,            17],
      ["s1_tp_publication_date",       1,"Purchase & Tender","1.18","Publication Date",                                                                                                       "text",         true,  "s1_tender_published",        "yes",           18],
      ["s1_tp_newspapers",             1,"Purchase & Tender","1.19","Newspaper(s)",                                                                                                           "text",         true,  "s1_tender_published",        "yes",           19],
      ["s1_tender_committee_approval", 1,"Purchase & Tender","1.20","Tender Committee Approval?",                                                                                             "yes_no",       false, null,                         null,            20],
      ["s1_tca_approval_number",       1,"Purchase & Tender","1.21","Approval Number",                                                                                                        "text",         true,  "s1_tender_committee_approval","yes",           21],
      ["s1_tca_approval_date",         1,"Purchase & Tender","1.22","Approval Date",                                                                                                          "text",         true,  "s1_tender_committee_approval","yes",           22],
      ["s1_tca_approved_value",        1,"Purchase & Tender","1.23","Approved Value (₹)",                                                                                                     "number",       true,  "s1_tender_committee_approval","yes",           23],
      ["s1_tca_name_of_approver",      1,"Purchase & Tender","1.24","Name of Approver",                                                                                                       "text",         true,  "s1_tender_committee_approval","yes",           24],
      ["s1_tca_authority_of_approver", 1,"Purchase & Tender","1.25","Authority of Approver",                                                                                                  "text",         true,  "s1_tender_committee_approval","yes",           25],
      ["s2_supply_order_available",    2,"Supply Order",     "2.1", "Supply Order Available?",                                                                                                "yes_no",       false, null,                         null,            1 ],
      ["s2_so_number",                 2,"Supply Order",     "2.2", "Supply Order No.",                                                                                                       "text",         true,  "s2_supply_order_available",  "yes",           2 ],
      ["s2_so_date",                   2,"Supply Order",     "2.3", "Supply Order Date",                                                                                                      "text",         true,  "s2_supply_order_available",  "yes",           3 ],
      ["s2_so_date_as_per_po",         2,"Supply Order",     "2.4", "Date of Supply as per PO",                                                                                               "text",         true,  "s2_supply_order_available",  "yes",           4 ],
      ["s2_so_actual_date_of_supply",  2,"Supply Order",     "2.5", "Actual Date of Supply",                                                                                                  "text",         true,  "s2_supply_order_available",  "yes",           5 ],
      ["s2_so_extended_date_required", 2,"Supply Order",     "2.6", "Extended Date Required?",                                                                                                "yes_no",       true,  "s2_supply_order_available",  "yes",           6 ],
      ["s3_attendance_verified",       3,"Attendance & EPF / ESIC","3.1","Attendance Verified?",                                                                                              "yes_no",       false, null,                         null,            1 ],
      ["s3_epf_esic_paid",             3,"Attendance & EPF / ESIC","3.2","EPF & ESIC Paid?",                                                                                                  "yes_no",       false, null,                         null,            2 ],
      ["s4_bill_type",                 4,"Bill Details",     "4.1", "Bill Type",                                                                                                              "text",         false, null,                         null,            1 ],
      ["s4_bill_number",               4,"Bill Details",     "4.2", "Bill Number",                                                                                                            "text",         false, null,                         null,            2 ],
      ["s4_bill_amount",               4,"Bill Details",     "4.3", "Bill Amount (₹)",                                                                                                        "number",       false, null,                         null,            3 ],
      ["s4_amount_sanctioned",         4,"Bill Details",     "4.4", "Amount Sanctioned (a) ₹",                                                                                               "number",       false, null,                         null,            4 ],
      ["s4_payment_till_date",         4,"Bill Details",     "4.5", "Payment Till Date (b) ₹",                                                                                               "number",       false, null,                         null,            5 ],
      ["s4_gross_amount",              4,"Bill Details",     "4.6", "Gross Amount as approved by Auditor / Accounts Officer",                                                                 "number",       false, null,                         null,            6 ],
      ["s4_security_deposit",          4,"Bill Details",     "4.7", "Security Deposit",                                                                                                       "number",       false, null,                         null,            7 ],
      ["s4_income_tax",                4,"Bill Details",     "4.8", "Income Tax",                                                                                                             "number",       false, null,                         null,            8 ],
      ["s4_penalty_ld",                4,"Bill Details",     "4.9", "Penalty / LD",                                                                                                           "number",       false, null,                         null,            9 ],
      ["s4_advance_adjusted",          4,"Bill Details",     "4.10","Advance Adjusted",                                                                                                       "number",       false, null,                         null,            10],
      ["s4_under_over_payment",        4,"Bill Details",     "4.11","Under / Over Payment in Last Bill",                                                                                      "number",       false, null,                         null,            11],
      ["s4_difference_amount",         4,"Bill Details",     "4.12","Difference in Amount as per agreement and total invoice till date",                                                      "number",       false, null,                         null,            12],
      ["s5_attendance_system_proper",  5,"Audit Checklist",  "5.1", "Whether attendance system is proper.",                                                                                   "yes_no_na",    false, null,                         null,            1 ],
      ["s5_comparative_statements",    5,"Audit Checklist",  "5.2", "Whether comparative statements prepared and approved by appropriate authority.",                                         "yes_no_na",    false, null,                         null,            2 ],
      ["s5_agreements_po_tender",      5,"Audit Checklist",  "5.3", "Whether copy of agreements / PO / tender for purchases more than ₹1 lakh was inspected by the Auditor.",               "yes_no_na",    false, null,                         null,            3 ],
      ["s5_earnest_money",             5,"Audit Checklist",  "5.4", "Whether Earnest Money / Security Deposit is 3% or more of the estimated purchase value.",                               "yes_no_na",    false, null,                         null,            4 ],
      ["s5_small_scale_industries",    5,"Audit Checklist",  "5.5", "Whether Industries registered as Small-Scale Industrial Units were given priority as per rules.",                        "yes_no_na",    false, null,                         null,            5 ],
      ["s5_plant_machinery_dga",       5,"Audit Checklist",  "5.6", "Whether important plant & machinery purchased from supplier registered with DGA&D.",                                    "yes_no_na",    false, null,                         null,            6 ],
      ["s5_payment_within_20_days",    5,"Audit Checklist",  "5.7", "Whether payment is likely to be made within 20 days of invoice / goods received.",                                      "yes_no_na",    false, null,                         null,            7 ],
      ["s5_late_payment_interest",     5,"Audit Checklist",  "5.8", "Whether in case of late payment without reason, interest at prevailing bank rate to be paid along with payment.",       "yes_no_na",    false, null,                         null,            8 ],
      ["s5_excel_calculation",         5,"Audit Checklist",  "5.9", "Prepare calculation in prescribed Excel sheet.",                                                                        "yes_no_na",    false, null,                         null,            9 ],
      ["s6_book_attendance_register",  6,"Documents",        "6.1", "Attendance Register",                                                                                                   "doc_pending_na",false,null,                         null,            1 ],
      ["s6_book_cheque_issue_register",6,"Documents",        "6.2", "Cheque Issue Register",                                                                                                 "doc_pending_na",false,null,                         null,            2 ],
      ["s6_book_cash_book",            6,"Documents",        "6.3", "Cash Book",                                                                                                             "doc_pending_na",false,null,                         null,            3 ],
      ["s6_book_work_file",            6,"Documents",        "6.4", "Work File",                                                                                                             "doc_pending_na",false,null,                         null,            4 ],
      ["s6_book_grant_register",       6,"Documents",        "6.5", "Grant Register (if applicable)",                                                                                        "doc_pending_na",false,null,                         null,            5 ],
      ["s6_sup_invoice",               6,"Documents",        "6.6", "Invoice",                                                                                                               "doc_pending_na",false,null,                         null,            6 ],
      ["s6_sup_attendance_register",   6,"Documents",        "6.7", "Attendance Register",                                                                                                   "doc_pending_na",false,null,                         null,            7 ],
      ["s6_sup_labour_license",        6,"Documents",        "6.8", "Labour License — Validity of Work",                                                                                     "doc_pending_na",false,null,                         null,            8 ],
      ["s6_sup_epf_esic_challan",      6,"Documents",        "6.9", "EPF and ESIC Challan",                                                                                                  "doc_pending_na",false,null,                         null,            9 ],
      ["s6_sup_payment_confirmation",  6,"Documents",        "6.10","Payment Confirmation Sheet",                                                                                             "doc_pending_na",false,null,                         null,            10],
      ["s6_sup_bank_statement",        6,"Documents",        "6.11","Bank Statement",                                                                                                        "doc_pending_na",false,null,                         null,            11],
    ];

    for (const [key, sec, sTitle, num, text, type, cond, pKey, pVal, sort] of questions) {
      // Build SQL with nullable varchars always inlined — never as params
      const pKeySql = pKey ? `$10` : `NULL::varchar`;
      const pValSql = pVal ? (pKey ? `$11` : `$10`) : `NULL::varchar`;
      const sortIdx = pKey && pVal ? 12 : (pKey || pVal) ? 11 : 10;
      await client.query(
        `INSERT INTO checklist_template_questions
           (id, template_id, section_number, section_title, question_key, question_number,
            question_text, response_type, is_conditional, parent_question_key,
            parent_trigger_value, sort_order, auto_query_title, auto_query_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${pKeySql},${pValSql},$${sortIdx},NULL::varchar,NULL::text)
         ON CONFLICT DO NOTHING`,
        [
          Q[key], T, sec, sTitle, key, num, text, type, cond,
          ...(pKey ? [pKey] : []),
          ...(pVal ? [pVal] : []),
          sort,
        ]
      );
    }

    // ── TIER 4: checklists ────────────────────────────────────────────────────
    console.log("⏳ Seeding checklists...");
    await insert(client,
      `INSERT INTO checklists (id, file_id, template_id, phase_number, checker_name, check_date, status, created_by, updated_by)
       VALUES ($1, $2, $3, 1, $4, '2026-03-10'::date, $5, $6, $6)`,
      [IDS.checklists.file1Phase1, IDS.files.file1, IDS.checklistTemplates.manpowerV1, "Muskan Agarwal", "In Progress", IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO checklists (id, file_id, template_id, phase_number, checker_name, check_date, status, created_by, updated_by)
       VALUES ($1, $2, $3, 1, $4, '2026-03-12'::date, $5, $6, $6)`,
      [IDS.checklists.file2Phase1, IDS.files.file2, IDS.checklistTemplates.manpowerV1, "Ramesh Verma", "Draft", IDS.users.om]
    );

    // ── TIER 4: file_version_history ──────────────────────────────────────────
    console.log("⏳ Seeding file_version_history...");
    await insert(client,
      `INSERT INTO file_version_history (id, file_id, version_number, changed_by, changed_by_role, reason, changed_at)
       VALUES ($1, $2, 1, $3, $4, $5, NOW())`,
      [IDS.fileVersionHistory.fvh1, IDS.files.file1, IDS.users.sahil, "State Controller", "Initial file creation"]
    );

    // ── TIER 5: file_version_changes ──────────────────────────────────────────
    console.log("⏳ Seeding file_version_changes...");
    await insert(client,
      `INSERT INTO file_version_changes (id, version_id, field_name, field_label, old_value, new_value)
       VALUES ($1, $2, $3, $4, NULL::text, $5)`,
      [IDS.fileVersionChanges.fvc1, IDS.fileVersionHistory.fvh1, "status", "File Status", "Created"]
    );
    await insert(client,
      `INSERT INTO file_version_changes (id, version_id, field_name, field_label, old_value, new_value)
       VALUES ($1, $2, $3, $4, NULL::text, $5)`,
      [IDS.fileVersionChanges.fvc2, IDS.fileVersionHistory.fvh1, "risk_flag", "Risk Flag", "Medium"]
    );

    // ── TIER 5: checklist_responses ───────────────────────────────────────────
    console.log("⏳ Seeding checklist_responses...");
    const CL1 = IDS.checklists.file1Phase1;
    const U   = IDS.users.sahil;

    const responses = [
      [CR.s1_gem_item_availability,     CL1, Q.s1_gem_item_availability,     "no"                                   ],
      [CR.s1_gem_mode_of_purchase,      CL1, Q.s1_gem_mode_of_purchase,      "By Tender"                            ],
      [CR.s1_tender_no,                 CL1, Q.s1_tender_no,                 "TND/2025/001"                         ],
      [CR.s1_tender_date,               CL1, Q.s1_tender_date,               "2025-01-15"                           ],
      [CR.s1_tender_details,            CL1, Q.s1_tender_details,            "Open tender published on state portal"],
      [CR.s1_estimated_amount,          CL1, Q.s1_estimated_amount,          "1250000"                              ],
      [CR.s1_source_of_fund,            CL1, Q.s1_source_of_fund,            "14th Finance Commission"              ],
      [CR.s1_financial_approval,        CL1, Q.s1_financial_approval,        "yes"                                  ],
      [CR.s1_fa_approval_number,        CL1, Q.s1_fa_approval_number,        "FA/2025/BLR/042"                      ],
      [CR.s1_fa_approval_date,          CL1, Q.s1_fa_approval_date,          "2025-01-10"                           ],
      [CR.s1_fa_approved_value,         CL1, Q.s1_fa_approved_value,         "1300000"                              ],
      [CR.s1_fa_name_of_approver,       CL1, Q.s1_fa_name_of_approver,       "Rajesh Kumar Singh"                   ],
      [CR.s1_fa_authority_of_approver,  CL1, Q.s1_fa_authority_of_approver,  "Municipal Commissioner"               ],
      [CR.s1_tender_published,          CL1, Q.s1_tender_published,          "yes"                                  ],
      [CR.s1_tp_publication_date,       CL1, Q.s1_tp_publication_date,       "2025-01-20"                           ],
      [CR.s1_tp_newspapers,             CL1, Q.s1_tp_newspapers,             "Dainik Bhaskar, Nai Duniya"           ],
      [CR.s1_tender_committee_approval, CL1, Q.s1_tender_committee_approval, "yes"                                  ],
      [CR.s1_tca_approval_number,       CL1, Q.s1_tca_approval_number,       "TCA/2025/001"                         ],
      [CR.s1_tca_approval_date,         CL1, Q.s1_tca_approval_date,         "2025-02-01"                           ],
      [CR.s1_tca_approved_value,        CL1, Q.s1_tca_approved_value,        "1250000"                              ],
      [CR.s1_tca_name_of_approver,      CL1, Q.s1_tca_name_of_approver,      "Vijay Prasad"                         ],
      [CR.s1_tca_authority_of_approver, CL1, Q.s1_tca_authority_of_approver, "Tender Committee Chairman"            ],
      [CR.s2_supply_order_available,    CL1, Q.s2_supply_order_available,    "yes"                                  ],
      [CR.s2_so_number,                 CL1, Q.s2_so_number,                 "SO/2025/BLR/001"                      ],
      [CR.s2_so_date,                   CL1, Q.s2_so_date,                   "2025-02-15"                           ],
      [CR.s2_so_date_as_per_po,         CL1, Q.s2_so_date_as_per_po,         "2025-03-01"                           ],
      [CR.s2_so_actual_date_of_supply,  CL1, Q.s2_so_actual_date_of_supply,  "2025-03-05"                           ],
      [CR.s2_so_extended_date_required, CL1, Q.s2_so_extended_date_required, "no"                                   ],
      [CR.s3_attendance_verified,       CL1, Q.s3_attendance_verified,       "yes"                                  ],
      [CR.s3_epf_esic_paid,             CL1, Q.s3_epf_esic_paid,             "yes"                                  ],
      [CR.s4_bill_type,                 CL1, Q.s4_bill_type,                 "Final Bill"                           ],
      [CR.s4_bill_number,               CL1, Q.s4_bill_number,               "BILL/2025/001"                        ],
      [CR.s4_bill_amount,               CL1, Q.s4_bill_amount,               "1250000"                              ],
      [CR.s4_amount_sanctioned,         CL1, Q.s4_amount_sanctioned,         "1250000"                              ],
      [CR.s4_payment_till_date,         CL1, Q.s4_payment_till_date,         "500000"                               ],
      [CR.s4_gross_amount,              CL1, Q.s4_gross_amount,              "1250000"                              ],
      [CR.s4_security_deposit,          CL1, Q.s4_security_deposit,          "37500"                                ],
      [CR.s4_income_tax,                CL1, Q.s4_income_tax,                "12500"                                ],
      [CR.s4_penalty_ld,                CL1, Q.s4_penalty_ld,                "0"                                    ],
      [CR.s4_advance_adjusted,          CL1, Q.s4_advance_adjusted,          "0"                                    ],
      [CR.s4_under_over_payment,        CL1, Q.s4_under_over_payment,        "0"                                    ],
      [CR.s4_difference_amount,         CL1, Q.s4_difference_amount,         "0"                                    ],
      [CR.s5_attendance_system_proper,  CL1, Q.s5_attendance_system_proper,  "yes"                                  ],
      [CR.s5_comparative_statements,    CL1, Q.s5_comparative_statements,    "yes"                                  ],
      [CR.s5_agreements_po_tender,      CL1, Q.s5_agreements_po_tender,      "yes"                                  ],
      [CR.s5_earnest_money,             CL1, Q.s5_earnest_money,             "yes"                                  ],
      [CR.s5_small_scale_industries,    CL1, Q.s5_small_scale_industries,    "na"                                   ],
      [CR.s5_plant_machinery_dga,       CL1, Q.s5_plant_machinery_dga,       "na"                                   ],
      [CR.s5_payment_within_20_days,    CL1, Q.s5_payment_within_20_days,    "yes"                                  ],
      [CR.s5_late_payment_interest,     CL1, Q.s5_late_payment_interest,     "na"                                   ],
      [CR.s5_excel_calculation,         CL1, Q.s5_excel_calculation,         "yes"                                  ],
      [CR.s6_book_attendance_register,  CL1, Q.s6_book_attendance_register,  "yes"                                  ],
      [CR.s6_book_cheque_issue_register,CL1, Q.s6_book_cheque_issue_register,"yes"                                  ],
      [CR.s6_book_cash_book,            CL1, Q.s6_book_cash_book,            "yes"                                  ],
      [CR.s6_book_work_file,            CL1, Q.s6_book_work_file,            "yes"                                  ],
      [CR.s6_book_grant_register,       CL1, Q.s6_book_grant_register,       "na"                                   ],
      [CR.s6_sup_invoice,               CL1, Q.s6_sup_invoice,               "yes"                                  ],
      [CR.s6_sup_attendance_register,   CL1, Q.s6_sup_attendance_register,   "yes"                                  ],
      [CR.s6_sup_labour_license,        CL1, Q.s6_sup_labour_license,        "yes"                                  ],
      [CR.s6_sup_epf_esic_challan,      CL1, Q.s6_sup_epf_esic_challan,      "yes"                                  ],
      [CR.s6_sup_payment_confirmation,  CL1, Q.s6_sup_payment_confirmation,  "pending"                              ],
      [CR.s6_sup_bank_statement,        CL1, Q.s6_sup_bank_statement,        "yes"                                  ],
    ];

    for (const [id, checklistId, questionId, responseValue] of responses) {
      await insert(client,
        `INSERT INTO checklist_responses (id, checklist_id, question_id, response_value, remark, responded_by, responded_at)
         VALUES ($1, $2, $3, $4, NULL::text, $5, NOW())`,
        [id, checklistId, questionId, responseValue, U]
      );
    }

    // ── TIER 5: attachments ───────────────────────────────────────────────────
    console.log("⏳ Seeding attachments...");
    await insert(client,
      `INSERT INTO attachments (id, file_id, checklist_id, category, slot, file_name, file_size, mime_type, file_type, storage_path, storage_backend, description, uploaded_by, is_deleted)
       VALUES ($1, $2, $3, 'mandatory', 'invoice', 'invoice_jan_2025.pdf', 204800, 'application/pdf', 'pdf', $4, 'local', $5, $6, false)`,
      [IDS.attachments.att1, IDS.files.file1, IDS.checklists.file1Phase1,
       "uploads/BLR/2025/MPS/0001/invoice_jan_2025.pdf",
       "Supplier invoice for January 2025", IDS.users.sahil]
    );

    // ── TIER 5: queries ───────────────────────────────────────────────────────
    console.log("⏳ Seeding queries...");
    await insert(client,
      `INSERT INTO queries (id, query_number, file_id, title, description, priority, status, raised_by, assigned_to, due_date, checklist_id, auto_generated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '2026-04-01'::date, $10, false)`,
      [IDS.queries.query1, "QRY/BLR/2025/001", IDS.files.file1,
       "EPF Challan not submitted for February 2025",
       "Supplier has not provided the EPF challan for February 2025. Payment cannot be processed without this document.",
       "High", "Open", IDS.users.sahil, IDS.users.om, IDS.checklists.file1Phase1]
    );
    await insert(client,
      `INSERT INTO queries (id, query_number, file_id, title, description, priority, status, raised_by, assigned_to, due_date, checklist_id, auto_generated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '2026-04-15'::date, NULL::uuid, false)`,
      [IDS.queries.query2, "QRY/KRB/2025/001", IDS.files.file2,
       "Tender committee approval document missing",
       "The tender committee approval minutes are not available in the file. Please attach the signed copy.",
       "Medium", "In Progress", IDS.users.sahil, IDS.users.om]
    );

    // ── TIER 6: query_participants ────────────────────────────────────────────
    console.log("⏳ Seeding query_participants...");
    await insert(client,
      `INSERT INTO query_participants (id, query_id, user_id, added_at, added_by)
       VALUES ($1, $2, $3, NOW(), $3)`,
      [IDS.queryParticipants.p1, IDS.queries.query1, IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO query_participants (id, query_id, user_id, added_at, added_by)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [IDS.queryParticipants.p2, IDS.queries.query1, IDS.users.om, IDS.users.sahil]
    );

    // ── TIER 6: query_replies ─────────────────────────────────────────────────
    console.log("⏳ Seeding query_replies...");
    await insert(client,
      `INSERT INTO query_replies (id, query_id, parent_reply_id, reply_text, replied_by, is_deleted)
       VALUES ($1, $2, NULL::uuid, $3, $4, false)`,
      [IDS.queryReplies.reply1, IDS.queries.query1,
       "We have noted the missing EPF challan. The supplier has been contacted and they will submit it by end of week.",
       IDS.users.om]
    );
    await insert(client,
      `INSERT INTO query_replies (id, query_id, parent_reply_id, reply_text, replied_by, is_deleted)
       VALUES ($1, $2, NULL::uuid, $3, $4, false)`,
      [IDS.queryReplies.reply2, IDS.queries.query1,
       "EPF challan for February has been submitted. Please find the document in the attachments.",
       IDS.users.sahil]
    );
    await insert(client,
      `INSERT INTO query_replies (id, query_id, parent_reply_id, reply_text, replied_by, is_deleted)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [IDS.queryReplies.reply3, IDS.queries.query1, IDS.queryReplies.reply1,
       "Thank you for the update. We will review the challan and close this query after verification.",
       IDS.users.om]
    );

    // ── TIER 6: query_activity_log ────────────────────────────────────────────
    console.log("⏳ Seeding query_activity_log...");
    await insert(client,
      `INSERT INTO query_activity_log (id, query_id, action_type, actor_id, detail, performed_at)
       VALUES ($1, $2, 'created', $3, $4, NOW() - INTERVAL '3 days')`,
      [IDS.queryActivityLog.log1, IDS.queries.query1, IDS.users.sahil, "Query created by Sahil"]
    );
    await insert(client,
      `INSERT INTO query_activity_log (id, query_id, action_type, actor_id, detail, performed_at)
       VALUES ($1, $2, 'assigned', $3, $4, NOW() - INTERVAL '2 days')`,
      [IDS.queryActivityLog.log2, IDS.queries.query1, IDS.users.sahil, "Query assigned to Om"]
    );
    await insert(client,
      `INSERT INTO query_activity_log (id, query_id, action_type, actor_id, detail, performed_at)
       VALUES ($1, $2, 'replied', $3, $4, NOW() - INTERVAL '1 day')`,
      [IDS.queryActivityLog.log3, IDS.queries.query1, IDS.users.om, "Om replied to the query"]
    );
    await insert(client,
      `INSERT INTO query_activity_log (id, query_id, action_type, actor_id, detail, performed_at)
       VALUES ($1, $2, 'created', $3, $4, NOW() - INTERVAL '2 days')`,
      [IDS.queryActivityLog.log4, IDS.queries.query2, IDS.users.sahil, "Query created by Sahil"]
    );

    // ── TIER 7: query_attachments ─────────────────────────────────────────────
    console.log("⏳ Seeding query_attachments...");
    await insert(client,
      `INSERT INTO query_attachments (id, query_id, reply_id, file_name, file_size, mime_type, storage_path, storage_backend, uploaded_by)
       VALUES ($1, $2, $3, $4, 153600, 'application/pdf', $5, 'local', $6)`,
      [IDS.queryAttachments.qa1, IDS.queries.query1, IDS.queryReplies.reply2,
       "epf_challan_feb_2025.pdf",
       "uploads/queries/QRY-BLR-2025-001/epf_challan_feb_2025.pdf",
       IDS.users.sahil]
    );

    await client.query("COMMIT");
    console.log("\n✅ Seed completed successfully!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 Summary:");
    console.log("   • 6 roles");
    console.log("   • 2 users (Sahil, Om) — State Controller, approve: true");
    console.log("   • 2 contract types (Manpower MPS, Civil CIV)");
    console.log("   • 2 suppliers");
    console.log("   • 2 ULBs (Bilaspur BLR, Korba KRB)");
    console.log("   • 2 teams + 3 team members + 3 ULB-team assignments");
    console.log("   • 1 checklist template (Manpower v1) — 65 questions with parent-child wiring");
    console.log("   • 2 files (BLR/2025/MPS/0001, KRB/2025/MPS/0001)");
    console.log("   • 2 checklists (phase 1 per file)");
    console.log("   • 62 checklist responses for file1/checklist1");
    console.log("   • 1 attachment");
    console.log("   • 1 file version history + 2 version changes");
    console.log("   • 2 queries + 2 participants + 3 replies + 4 activity logs + 1 query attachment");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Seed FAILED — transaction rolled back.\n");
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();