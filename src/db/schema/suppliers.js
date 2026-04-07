import {
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),

  supplierName: varchar("supplier_name", { length: 300 }).notNull(),

  pan: varchar("pan", { length: 10 }),

  gstNo: varchar("gst_no", { length: 15 }),

  epfRegistrationNo: varchar("epf_registration_no", { length: 50 }),

  esicRegistrationNo: varchar("esic_registration_no", { length: 50 }),

  labourLicenceNo: varchar("labour_licence_no", { length: 100 }),

  departmentName: varchar("department_name", { length: 200 }),

  fileNo: varchar("file_no", { length: 50 }),

  fundName: varchar("fund_name", { length: 200 }),
});