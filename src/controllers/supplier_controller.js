import { db } from "../db/index.js";
import { suppliers } from "../db/schema/suppliers.js";

export const createSupplier = async (req, res) => {
  try {
    const {
      supplierName,
      pan,
      gstNumber,
      epfRegNo,
      esicRegNo,
      labourLicenseNo,
      nameOfDepartment,
      fileNo,
      nameOfFund,
    } = req.body;

    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        supplierName,
        pan,
        gstNo: gstNumber,
        epfRegistrationNo: epfRegNo,
        esicRegistrationNo: esicRegNo,
        labourLicenceNo: labourLicenseNo,
        departmentName: nameOfDepartment,
        fileNo,
        fundName: nameOfFund,
      })
      .returning();

    res.json({
      success: true,
      supplier: newSupplier,
    });

  } catch (err) {
    console.error("CREATE SUPPLIER ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to create supplier",
    });
  }
};