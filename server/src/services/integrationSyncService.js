import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   CONSTANTS
========================================================= */

const EMPLOYEE_TARGET_OBJECTS = [
  "employee",
  "employees",
];

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return String(value ?? "").trim();
}

function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    cleanString(value) === ""
  );
}

function getNestedValue(object, path) {
  if (!object || !path) {
    return undefined;
  }

  const parts = String(path)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  let current = object;

  for (const part of parts) {
    if (
      current === null ||
      current === undefined
    ) {
      return undefined;
    }

    if (
      typeof current !== "object" ||
      !(part in current)
    ) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function setNestedValue(
  object,
  path,
  value
) {
  if (!object || !path) {
    return;
  }

  const parts = String(path)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return;
  }

  let current = object;

  for (
    let index = 0;
    index < parts.length - 1;
    index += 1
  ) {
    const part = parts[index];

    if (
      !current[part] ||
      typeof current[part] !== "object"
    ) {
      current[part] = {};
    }

    current = current[part];
  }

  current[
    parts[parts.length - 1]
  ] = value;
}

/* =========================================================
   TRANSFORM VALUES
========================================================= */

function applyTransform(
  value,
  transformRule
) {
  if (
    isEmpty(value) ||
    !transformRule
  ) {
    return value;
  }

  const rule = cleanString(
    transformRule
  ).toLowerCase();

  switch (rule) {
    case "lowercase":
      return String(value).toLowerCase();

    case "uppercase":
      return String(value).toUpperCase();

    case "trim":
      return String(value).trim();

    case "string":
      return String(value);

    case "number": {
      const numberValue =
        Number(value);

      return Number.isNaN(numberValue)
        ? value
        : numberValue;
    }

    case "boolean": {
      if (
        typeof value ===
        "boolean"
      ) {
        return value;
      }

      const normalized =
        String(value)
          .trim()
          .toLowerCase();

      if (
        [
          "true",
          "1",
          "yes",
          "active",
        ].includes(normalized)
      ) {
        return true;
      }

      if (
        [
          "false",
          "0",
          "no",
          "inactive",
        ].includes(normalized)
      ) {
        return false;
      }

      return value;
    }

    case "date": {
      try {
        return value
          ? new Date(value)
              .toISOString()
              .slice(0, 10)
          : value;
      } catch {
        return value;
      }
    }

    default:
      return value;
  }
}

/* =========================================================
   NORMALIZE EXTERNAL RESPONSE
========================================================= */

/*
 * External HR systems do not always return JSON in exactly
 * the same shape.
 *
 * Supported:
 *
 * 1. { employees: [...] }
 * 2. { data: [...] }
 * 3. { data: { employees: [...] } }
 * 4. { results: [...] }
 * 5. { results: { employees: [...] } }
 * 6. [...]
 * 7. JSON encoded as a string
 * 8. Double-encoded JSON
 */

function normalizeExternalResponse(body) {
  let normalized = body;

  /*
   * Handle JSON that has already been returned as a string.
   */
  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    if (
      typeof normalized !==
      "string"
    ) {
      break;
    }

    const trimmed =
      normalized.trim();

    if (!trimmed) {
      return null;
    }

    try {
      normalized =
        JSON.parse(trimmed);
    } catch {
      break;
    }
  }

  return normalized;
}

/* =========================================================
   FETCH EXTERNAL DATA
========================================================= */

async function fetchExternalData({
  baseUrl,
  headers,
  timeoutMs = 15000,
}) {
  if (!baseUrl) {
    throw new Error(
      "Integration does not have a base URL."
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, timeoutMs);

  const startedAt =
    Date.now();

  try {
    console.log(
      "[IntegrationSync] Fetching external HR API:",
      baseUrl
    );

    const response =
      await fetch(
        baseUrl,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
            ...headers,
          },

          signal:
            controller.signal,
        }
      );

    const durationMs =
      Date.now() - startedAt;

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    /*
     * Always read the response as text first.
     *
     * This is intentional.
     *
     * It allows us to handle:
     *
     * - application/json
     * - text/plain containing JSON
     * - JSON encoded as a string
     * - double encoded JSON
     */
    const responseText =
      await response.text();

    if (!response.ok) {
      throw new Error(
        `External API returned HTTP ${response.status}: ${responseText.slice(
          0,
          1000
        )}`
      );
    }

    let body = null;

    if (
      responseText.trim()
    ) {
      try {
        body =
          JSON.parse(
            responseText
          );
      } catch {
        /*
         * Some test APIs may return a
         * plain string.
         *
         * Keep it so the caller can
         * generate a useful diagnostic.
         */
        body =
          responseText;
      }
    }

    /*
     * Normalize JSON strings / double encoded JSON.
     */
    body =
      normalizeExternalResponse(
        body
      );

    console.log(
      "[IntegrationSync] External API response:",
      {
        httpStatus:
          response.status,

        contentType,

        responseLength:
          responseText.length,

        bodyType:
          typeof body,

        bodyIsArray:
          Array.isArray(body),

        bodyKeys:
          body &&
          typeof body ===
            "object" &&
          !Array.isArray(body)
            ? Object.keys(body)
            : [],

        responsePreview:
          responseText.slice(
            0,
            500
          ),
      }
    );

    return {
      response,
      body,
      durationMs,
    };
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        `External API request timed out after ${timeoutMs}ms.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   EXTRACT RECORD ARRAY
========================================================= */

function extractRecords(
  responseBody
) {
  const body =
    normalizeExternalResponse(
      responseBody
    );

  /*
   * Direct array.
   */
  if (
    Array.isArray(body)
  ) {
    return body;
  }

  if (
    !body ||
    typeof body !==
      "object"
  ) {
    return [];
  }

  /*
   * { employees: [...] }
   */
  if (
    Array.isArray(
      body.employees
    )
  ) {
    return body.employees;
  }

  /*
   * { data: [...] }
   */
  if (
    Array.isArray(
      body.data
    )
  ) {
    return body.data;
  }

  /*
   * { data: { employees: [...] } }
   */
  if (
    Array.isArray(
      body.data?.employees
    )
  ) {
    return body.data.employees;
  }

  /*
   * { results: [...] }
   */
  if (
    Array.isArray(
      body.results
    )
  ) {
    return body.results;
  }

  /*
   * { results: { employees: [...] } }
   */
  if (
    Array.isArray(
      body.results?.employees
    )
  ) {
    return body.results.employees;
  }

  /*
   * Additional common HR API shapes.
   *
   * { records: [...] }
   */
  if (
    Array.isArray(
      body.records
    )
  ) {
    return body.records;
  }

  /*
   * { data: { records: [...] } }
   */
  if (
    Array.isArray(
      body.data?.records
    )
  ) {
    return body.data.records;
  }

  return [];
}

/* =========================================================
   APPLY FIELD MAPPINGS
========================================================= */

function applyMappings(
  externalRecord,
  mappings
) {
  const targetRecord = {};

  for (const mapping of mappings) {
    if (
      !mapping ||
      mapping.is_active === false
    ) {
      continue;
    }

    /*
     * Only inbound mappings can move data
     * from the external HR system into our
     * platform.
     */
    if (
      mapping.direction !==
      "inbound"
    ) {
      continue;
    }

    const sourceValue =
      getNestedValue(
        externalRecord,
        mapping.source_field
      );

    if (
      sourceValue ===
      undefined
    ) {
      continue;
    }

    const transformedValue =
      applyTransform(
        sourceValue,
        mapping.transform_rule
      );

    setNestedValue(
      targetRecord,
      mapping.target_field,
      transformedValue
    );
  }

  return targetRecord;
}

/* =========================================================
   NORMALIZE EMPLOYEE
========================================================= */

function normalizeEmployee(
  mappedRecord,
  organizationId
) {
  const employee = {
    organization_id:
      organizationId,

    full_name:
      cleanString(
        mappedRecord.full_name
      ),

    email:
      cleanString(
        mappedRecord.email
      ).toLowerCase(),

    department:
      isEmpty(
        mappedRecord.department
      )
        ? null
        : cleanString(
            mappedRecord.department
          ),

    title:
      isEmpty(
        mappedRecord.title
      )
        ? null
        : cleanString(
            mappedRecord.title
          ),

    employee_code:
      isEmpty(
        mappedRecord.employee_code
      )
        ? null
        : cleanString(
            mappedRecord.employee_code
          ),

    joining_date:
      isEmpty(
        mappedRecord.joining_date
      )
        ? null
        : cleanString(
            mappedRecord.joining_date
          ),

    employment_status:
      isEmpty(
        mappedRecord.employment_status
      )
        ? "Active"
        : cleanString(
            mappedRecord.employment_status
          ),

    last_working_date:
      isEmpty(
        mappedRecord.last_working_date
      )
        ? null
        : cleanString(
            mappedRecord.last_working_date
          ),

    address:
      isEmpty(
        mappedRecord.address
      )
        ? null
        : cleanString(
            mappedRecord.address
          ),

    manager_id:
      isEmpty(
        mappedRecord.manager_id
      )
        ? null
        : mappedRecord.manager_id,
  };

  return employee;
}

/* =========================================================
   VALIDATE EMPLOYEE
========================================================= */

function validateEmployee(
  employee
) {
  const errors = [];

  if (
    !employee.full_name
  ) {
    errors.push(
      "full_name is required."
    );
  }

  if (
    !employee.email
  ) {
    errors.push(
      "email is required."
    );
  }

  if (
    employee.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      employee.email
    )
  ) {
    errors.push(
      "email is invalid."
    );
  }

  return errors;
}

/* =========================================================
   FIND EXISTING EMPLOYEE
========================================================= */

async function findExistingEmployee({
  organizationId,
  employee,
}) {
  /*
   * employee_code is the preferred
   * external identifier.
   */
  if (
    employee.employee_code
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("employees")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "employee_code",
          employee.employee_code
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to find employee by employee_code: ${error.message}`
      );
    }

    if (data) {
      return data;
    }
  }

  /*
   * Email is the fallback identifier.
   */
  if (
    employee.email
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("employees")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "email",
          employee.email
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to find employee by email: ${error.message}`
      );
    }

    if (data) {
      return data;
    }
  }

  return null;
}

/* =========================================================
   CREATE EMPLOYEE
========================================================= */

async function createEmployee(
  employee
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("employees")
      .insert(employee)
      .select("*")
      .single();

  if (error) {
    throw new Error(
      `Failed to create employee: ${error.message}`
    );
  }

  return data;
}

/* =========================================================
   UPDATE EMPLOYEE
========================================================= */

async function updateEmployee(
  existingEmployee,
  employee
) {
  /*
   * Never overwrite the primary key
   * or organization ID.
   */
  const updatePayload = {
    full_name:
      employee.full_name,

    email:
      employee.email,

    department:
      employee.department,

    title:
      employee.title,

    employee_code:
      employee.employee_code,

    joining_date:
      employee.joining_date,

    employment_status:
      employee.employment_status,

    last_working_date:
      employee.last_working_date,

    address:
      employee.address,

    manager_id:
      employee.manager_id,
  };

  /*
   * Remove undefined values so an incomplete
   * external record does not accidentally
   * erase existing information.
   */
  for (
    const key of Object.keys(
      updatePayload
    )
  ) {
    if (
      updatePayload[key] ===
      undefined
    ) {
      delete updatePayload[key];
    }
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("employees")
      .update(
        updatePayload
      )
      .eq(
        "id",
        existingEmployee.id
      )
      .eq(
        "organization_id",
        existingEmployee.organization_id
      )
      .select("*")
      .single();

  if (error) {
    throw new Error(
      `Failed to update employee: ${error.message}`
    );
  }

  return data;
}

/* =========================================================
   PROCESS ONE EMPLOYEE
========================================================= */

async function processEmployee({
  externalRecord,
  mappings,
  organizationId,
}) {
  const mappedRecord =
    applyMappings(
      externalRecord,
      mappings
    );

  /*
   * If there are no useful mappings,
   * the record cannot safely be synchronized.
   */
  if (
    Object.keys(
      mappedRecord
    ).length === 0
  ) {
    throw new Error(
      "No active inbound field mappings produced any values."
    );
  }

  const employee =
    normalizeEmployee(
      mappedRecord,
      organizationId
    );

  const validationErrors =
    validateEmployee(
      employee
    );

  if (
    validationErrors.length
  ) {
    throw new Error(
      validationErrors.join(
        " "
      )
    );
  }

  const existingEmployee =
    await findExistingEmployee({
      organizationId,
      employee,
    });

  if (
    existingEmployee
  ) {
    const updated =
      await updateEmployee(
        existingEmployee,
        employee
      );

    return {
      action: "updated",
      employee:
        updated,
    };
  }

  const created =
    await createEmployee(
      employee
    );

  return {
    action: "created",
    employee:
      created,
  };
}

/* =========================================================
   MAIN SYNC FUNCTION
========================================================= */

export async function synchronizeIntegration({
  integration,
  organizationId,
  mappings,
  headers,
}) {
  const startedAt =
    Date.now();

  if (
    !integration
  ) {
    throw new Error(
      "Integration is required."
    );
  }

  if (
    !organizationId
  ) {
    throw new Error(
      "Organization is required."
    );
  }

  /*
   * Only inbound or bidirectional integrations
   * can import external employee data.
   */
  if (
    ![
      "inbound",
      "bidirectional",
    ].includes(
      integration.sync_direction
    )
  ) {
    throw new Error(
      "This integration is configured for outbound synchronization only."
    );
  }

  if (
    !integration.base_url
  ) {
    throw new Error(
      "Integration does not have a base URL."
    );
  }

  /*
   * Load only active inbound employee mappings.
   *
   * The caller normally provides mappings already loaded
   * from integration_mappings, but we filter again here
   * as a safety boundary.
   */
  const activeMappings =
    (
      mappings || []
    ).filter(
      (mapping) =>
        mapping &&
        mapping.is_active !==
          false &&
        mapping.direction ===
          "inbound" &&
        EMPLOYEE_TARGET_OBJECTS.includes(
          cleanString(
            mapping.target_object
          ).toLowerCase()
        )
    );

  if (
    activeMappings.length ===
    0
  ) {
    throw new Error(
      "No active inbound employee field mappings were found."
    );
  }

  console.log(
    "--------------------------------------------------"
  );

  console.log(
    "[IntegrationSync] Starting synchronization."
  );

  console.log(
    "[IntegrationSync] Integration:",
    integration.id
  );

  console.log(
    "[IntegrationSync] Organization:",
    organizationId
  );

  console.log(
    "[IntegrationSync] Integration loaded:",
    integration.provider ||
      integration.name ||
      "Unknown"
  );

  console.log(
    "[IntegrationSync] Total mappings:",
    (mappings || []).length
  );

  console.log(
    "[IntegrationSync] Active inbound mappings:",
    activeMappings.length
  );

  console.log(
    "[IntegrationSync] Mappings:"
  );

  for (
    const mapping of activeMappings
  ) {
    console.log(
      `  ${mapping.source_field} -> ${mapping.target_object}.${mapping.target_field}`
    );
  }

  /*
   * Fetch external records.
   */
  const {
    body,
    durationMs,
    response,
  } =
    await fetchExternalData({
      baseUrl:
        integration.base_url,

      headers,
    });

  /*
   * Extract employee records.
   */
  const externalRecords =
    extractRecords(body);

  /*
   * Detailed diagnostic information.
   */
  console.log(
    "[IntegrationSync] External response debug:",
    {
      httpStatus:
        response?.status,

      bodyType:
        typeof body,

      bodyIsArray:
        Array.isArray(body),

      bodyKeys:
        body &&
        typeof body ===
          "object" &&
        !Array.isArray(body)
          ? Object.keys(body)
          : [],

      employeesIsArray:
        Array.isArray(
          body?.employees
        ),

      employeesCount:
        Array.isArray(
          body?.employees
        )
          ? body.employees.length
          : 0,

      dataIsArray:
        Array.isArray(
          body?.data
        ),

      resultsIsArray:
        Array.isArray(
          body?.results
        ),

      recordsIsArray:
        Array.isArray(
          body?.records
        ),

      extractedRecords:
        externalRecords.length,
    }
  );

  /*
   * If nothing was returned, this is still a
   * technically successful HTTP synchronization,
   * but no employee data was available.
   */
  if (
    externalRecords.length ===
    0
  ) {
    const bodyPreview =
      typeof body ===
      "string"
        ? body.slice(0, 1000)
        : JSON.stringify(
            body ?? null
          ).slice(
            0,
            1000
          );

    console.log(
      "[IntegrationSync] No employee records found."
    );

    console.log(
      "[IntegrationSync] Response preview:",
      bodyPreview
    );

    return {
      success: true,

      httpStatus:
        response?.status ||
        200,

      durationMs,

      recordsProcessed: 0,

      recordsCreated: 0,

      recordsUpdated: 0,

      recordsFailed: 0,

      errors: [],

      message:
        "Synchronization completed. No employee records were returned by the external HR system.",
    };
  }

  let recordsCreated =
    0;

  let recordsUpdated =
    0;

  let recordsFailed =
    0;

  const errors = [];

  /*
   * Process every external employee independently.
   *
   * One bad employee should not stop the
   * remaining employees from synchronizing.
   */
  for (
    let index = 0;
    index <
    externalRecords.length;
    index += 1
  ) {
    const externalRecord =
      externalRecords[index];

    console.log(
      `[IntegrationSync] Processing record ${index + 1}/${externalRecords.length}`
    );

    try {
      const result =
        await processEmployee({
          externalRecord,

          mappings:
            activeMappings,

          organizationId,
        });

      if (
        result.action ===
        "created"
      ) {
        recordsCreated +=
          1;

        console.log(
          "[IntegrationSync] Employee created:",
          result.employee
            ?.employee_code ||
            result.employee
              ?.email
        );
      }

      if (
        result.action ===
        "updated"
      ) {
        recordsUpdated +=
          1;

        console.log(
          "[IntegrationSync] Employee updated:",
          result.employee
            ?.employee_code ||
            result.employee
              ?.email
        );
      }
    } catch (error) {
      recordsFailed +=
        1;

      const errorMessage =
        error?.message ||
        "Employee synchronization failed.";

      errors.push({
        record_index:
          index,

        employee_id:
          externalRecord
            ?.employee_id ||
          externalRecord
            ?.employeeCode ||
          externalRecord
            ?.employee_code ||
          null,

        email:
          externalRecord
            ?.email ||
          null,

        message:
          errorMessage,
      });

      console.error(
        `[IntegrationSync] Employee record ${index + 1} failed:`,
        errorMessage
      );
    }
  }

  const recordsProcessed =
    externalRecords.length;

  const totalDurationMs =
    Date.now() -
    startedAt;

  const success =
    recordsFailed === 0;

  let message;

  if (
    success
  ) {
    message =
      `Synchronization completed successfully. ${recordsCreated} created, ${recordsUpdated} updated, 0 failed.`;
  } else {
    message =
      `Synchronization completed with errors. ${recordsCreated} created, ${recordsUpdated} updated, ${recordsFailed} failed.`;
  }

  console.log(
    "[IntegrationSync] Sync summary:"
  );

  console.log(
    "[IntegrationSync] Records processed:",
    recordsProcessed
  );

  console.log(
    "[IntegrationSync] Records created:",
    recordsCreated
  );

  console.log(
    "[IntegrationSync] Records updated:",
    recordsUpdated
  );

  console.log(
    "[IntegrationSync] Records failed:",
    recordsFailed
  );

  console.log(
    "[IntegrationSync] Duration:",
    totalDurationMs,
    "ms"
  );

  console.log(
    "--------------------------------------------------"
  );

  return {
    success,

    httpStatus:
      response?.status ||
      200,

    durationMs:
      totalDurationMs,

    recordsProcessed,

    recordsCreated,

    recordsUpdated,

    recordsFailed,

    errors,

    message,
  };
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default synchronizeIntegration;