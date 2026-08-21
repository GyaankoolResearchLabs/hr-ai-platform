import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION RESOLUTION
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id
    );

    if (!organization) {
      return res.status(403).json({
        message:
          "Complete organization setup first",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "Shift & Holiday organization lookup error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return String(value ?? "").trim();
}

function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );
}

function isValidDate(value) {
  if (!value) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  return !Number.isNaN(date.getTime());
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(
    String(value ?? "")
  );
}

function normalizeWorkingDays(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((day) =>
      cleanString(day)
    )
    .filter(Boolean);
}

/* =========================================================
   GET ALL DATA
   GET /api/shift-holiday
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      req.organization.id;

    const [
      locationsResult,
      holidaysResult,
      shiftsResult,
      assignmentsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("organization_locations")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .order("name", {
          ascending: true,
        }),

      supabaseAdmin
        .from("organization_holidays")
        .select(
          `
            *,
            organization_locations (
              id,
              name,
              country
            )
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order("holiday_date", {
          ascending: true,
        }),

      supabaseAdmin
        .from("organization_shifts")
        .select(
          `
            *,
            organization_locations (
              id,
              name,
              country
            )
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order("name", {
          ascending: true,
        }),

      supabaseAdmin
        .from("employee_shift_assignments")
        .select(
          `
            *,
            employees (
              id,
              full_name,
              email,
              department,
              title,
              employee_code
            ),
            organization_shifts (
              id,
              name,
              start_time,
              end_time,
              working_days,
              location_id
            )
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (locationsResult.error) {
      console.error(
        "Load locations error:",
        locationsResult.error
      );

      return res.status(500).json({
        message:
          "Could not load locations",
        detail:
          locationsResult.error.message,
      });
    }

    if (holidaysResult.error) {
      console.error(
        "Load holidays error:",
        holidaysResult.error
      );

      return res.status(500).json({
        message:
          "Could not load holidays",
        detail:
          holidaysResult.error.message,
      });
    }

    if (shiftsResult.error) {
      console.error(
        "Load shifts error:",
        shiftsResult.error
      );

      return res.status(500).json({
        message:
          "Could not load shifts",
        detail:
          shiftsResult.error.message,
      });
    }

    if (assignmentsResult.error) {
      console.error(
        "Load shift assignments error:",
        assignmentsResult.error
      );

      return res.status(500).json({
        message:
          "Could not load employee shift assignments",
        detail:
          assignmentsResult.error.message,
      });
    }

    return res.json({
      locations:
        locationsResult.data || [],

      holidays:
        holidaysResult.data || [],

      shifts:
        shiftsResult.data || [],

      assignments:
        assignmentsResult.data || [],
    });
  } catch (error) {
    console.error(
      "Unexpected shift holiday load error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not load shift and holiday data",
    });
  }
});

/* =========================================================
   LOCATIONS
========================================================= */

/*
   GET /api/shift-holiday/locations
*/

router.get(
  "/locations",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_locations")
        .select("*")
        .eq(
          "organization_id",
          req.organization.id
        )
        .order("name", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Load locations error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load locations",
          detail: error.message,
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Unexpected locations error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load locations",
      });
    }
  }
);

/*
   POST /api/shift-holiday/locations
*/

router.post(
  "/locations",
  async (req, res) => {
    try {
      const {
        name,
        country,
      } = req.body || {};

      const cleanedName =
        cleanString(name);

      const cleanedCountry =
        cleanString(country) ||
        "India";

      if (!cleanedName) {
        return res.status(400).json({
          message:
            "Location name is required",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_locations")
        .insert({
          organization_id:
            req.organization.id,

          name: cleanedName,

          country:
            cleanedCountry,
        })
        .select("*")
        .single();

      if (error) {
        console.error(
          "Create location error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not create location",
          detail: error.message,
        });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error(
        "Unexpected create location error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not create location",
      });
    }
  }
);

/*
   PUT /api/shift-holiday/locations/:id
*/

router.put(
  "/locations/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({
          message:
            "Invalid location ID",
        });
      }

      const {
        name,
        country,
      } = req.body || {};

      const cleanedName =
        cleanString(name);

      if (!cleanedName) {
        return res.status(400).json({
          message:
            "Location name is required",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_locations")
        .update({
          name: cleanedName,

          country:
            cleanString(country) ||
            "India",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id)
        .eq(
          "organization_id",
          req.organization.id
        )
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "Update location error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not update location",
          detail: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Location not found",
        });
      }

      return res.json(data);
    } catch (error) {
      console.error(
        "Unexpected update location error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not update location",
      });
    }
  }
);

/*
   DELETE /api/shift-holiday/locations/:id
*/

router.delete(
  "/locations/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({
          message:
            "Invalid location ID",
        });
      }

      const {
        data: location,
        error:
          locationError,
      } = await supabaseAdmin
        .from("organization_locations")
        .select("id")
        .eq("id", id)
        .eq(
          "organization_id",
          req.organization.id
        )
        .maybeSingle();

      if (locationError) {
        return res.status(500).json({
          message:
            "Could not verify location",
          detail:
            locationError.message,
        });
      }

      if (!location) {
        return res.status(404).json({
          message:
            "Location not found",
        });
      }

      const {
        count: holidayCount,
        error:
          holidayCountError,
      } = await supabaseAdmin
        .from("organization_holidays")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "organization_id",
          req.organization.id
        )
        .eq(
          "location_id",
          id
        );

      if (holidayCountError) {
        return res.status(500).json({
          message:
            "Could not check location holidays",
          detail:
            holidayCountError.message,
        });
      }

      if ((holidayCount || 0) > 0) {
        return res.status(409).json({
          message:
            "This location has holidays assigned to it. Remove those holidays before deleting the location.",
        });
      }

      const {
        count: shiftCount,
        error:
          shiftCountError,
      } = await supabaseAdmin
        .from("organization_shifts")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "organization_id",
          req.organization.id
        )
        .eq(
          "location_id",
          id
        );

      if (shiftCountError) {
        return res.status(500).json({
          message:
            "Could not check location shifts",
          detail:
            shiftCountError.message,
        });
      }

      if ((shiftCount || 0) > 0) {
        return res.status(409).json({
          message:
            "This location has shifts assigned to it. Remove those shifts before deleting the location.",
        });
      }

      const {
        error,
      } = await supabaseAdmin
        .from("organization_locations")
        .delete()
        .eq("id", id)
        .eq(
          "organization_id",
          req.organization.id
        );

      if (error) {
        console.error(
          "Delete location error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not delete location",
          detail: error.message,
        });
      }

      return res.json({
        message:
          "Location deleted successfully",
      });
    } catch (error) {
      console.error(
        "Unexpected delete location error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not delete location",
      });
    }
  }
);

/* =========================================================
   HOLIDAYS
========================================================= */

/*
   GET /api/shift-holiday/holidays
*/

router.get(
  "/holidays",
  async (req, res) => {
    try {
      const {
        location_id,
        year,
      } = req.query;

      let query =
        supabaseAdmin
          .from("organization_holidays")
          .select(
            `
              *,
              organization_locations (
                id,
                name,
                country
              )
            `
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .order("holiday_date", {
            ascending: true,
          });

      if (location_id) {
        if (
          !isValidUUID(location_id)
        ) {
          return res.status(400).json({
            message:
              "Invalid location ID",
          });
        }

        query = query.eq(
          "location_id",
          location_id
        );
      }

      if (year) {
        const yearNumber =
          Number(year);

        if (
          !Number.isInteger(
            yearNumber
          ) ||
          yearNumber < 2000 ||
          yearNumber > 2100
        ) {
          return res.status(400).json({
            message:
              "Invalid holiday year",
          });
        }

        query = query
          .gte(
            "holiday_date",
            `${yearNumber}-01-01`
          )
          .lte(
            "holiday_date",
            `${yearNumber}-12-31`
          );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Load holidays error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load holidays",
          detail: error.message,
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Unexpected holidays error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load holidays",
      });
    }
  }
);

/*
   POST /api/shift-holiday/holidays
*/

router.post(
  "/holidays",
  async (req, res) => {
    try {
      const {
        name,
        date,
        holiday_date,
        location_id,
        type,
        holiday_type,
      } = req.body || {};

      const cleanedName =
        cleanString(name);

      const cleanedDate =
        cleanString(
          holiday_date || date
        );

      const cleanedType =
        cleanString(
          holiday_type || type
        ) ||
        "Public Holiday";

      if (!cleanedName) {
        return res.status(400).json({
          message:
            "Holiday name is required",
        });
      }

      if (
        !isValidDate(cleanedDate)
      ) {
        return res.status(400).json({
          message:
            "Valid holiday date is required",
        });
      }

      if (
        !location_id ||
        !isValidUUID(location_id)
      ) {
        return res.status(400).json({
          message:
            "Valid location is required",
        });
      }

      const {
        data: location,
        error:
          locationError,
      } = await supabaseAdmin
        .from("organization_locations")
        .select("id")
        .eq(
          "id",
          location_id
        )
        .eq(
          "organization_id",
          req.organization.id
        )
        .maybeSingle();

      if (locationError) {
        return res.status(500).json({
          message:
            "Could not verify location",
          detail:
            locationError.message,
        });
      }

      if (!location) {
        return res.status(404).json({
          message:
            "Location not found in your organization",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_holidays")
        .insert({
          organization_id:
            req.organization.id,

          location_id,

          name: cleanedName,

          holiday_date:
            cleanedDate,

          holiday_type:
            cleanedType,
        })
        .select(
          `
            *,
            organization_locations (
              id,
              name,
              country
            )
          `
        )
        .single();

      if (error) {
        console.error(
          "Create holiday error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not create holiday",
          detail: error.message,
        });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error(
        "Unexpected create holiday error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not create holiday",
      });
    }
  }
);

/*
   PUT /api/shift-holiday/holidays/:id
*/

router.put(
  "/holidays/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({
          message:
            "Invalid holiday ID",
        });
      }

      const {
        name,
        date,
        holiday_date,
        location_id,
        type,
        holiday_type,
      } = req.body || {};

      const cleanedName =
        cleanString(name);

      const cleanedDate =
        cleanString(
          holiday_date || date
        );

      const cleanedType =
        cleanString(
          holiday_type || type
        ) ||
        "Public Holiday";

      if (!cleanedName) {
        return res.status(400).json({
          message:
            "Holiday name is required",
        });
      }

      if (
        !isValidDate(cleanedDate)
      ) {
        return res.status(400).json({
          message:
            "Valid holiday date is required",
        });
      }

      if (
        !location_id ||
        !isValidUUID(location_id)
      ) {
        return res.status(400).json({
          message:
            "Valid location is required",
        });
      }

      const {
        data: location,
        error:
          locationError,
      } = await supabaseAdmin
        .from("organization_locations")
        .select("id")
        .eq(
          "id",
          location_id
        )
        .eq(
          "organization_id",
          req.organization.id
        )
        .maybeSingle();

      if (locationError) {
        return res.status(500).json({
          message:
            "Could not verify location",
          detail:
            locationError.message,
        });
      }

      if (!location) {
        return res.status(404).json({
          message:
            "Location not found in your organization",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_holidays")
        .update({
          name: cleanedName,

          holiday_date:
            cleanedDate,

          location_id,

          holiday_type:
            cleanedType,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id)
        .eq(
          "organization_id",
          req.organization.id
        )
        .select(
          `
            *,
            organization_locations (
              id,
              name,
              country
            )
          `
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Update holiday error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not update holiday",
          detail: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Holiday not found",
        });
      }

      return res.json(data);
    } catch (error) {
      console.error(
        "Unexpected update holiday error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not update holiday",
      });
    }
  }
);

/*
   DELETE /api/shift-holiday/holidays/:id
*/

router.delete(
  "/holidays/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({
          message:
            "Invalid holiday ID",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_holidays")
        .delete()
        .eq("id", id)
        .eq(
          "organization_id",
          req.organization.id
        )
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          "Delete holiday error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not delete holiday",
          detail: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Holiday not found",
        });
      }

      return res.json({
        message:
          "Holiday deleted successfully",
      });
    } catch (error) {
      console.error(
        "Unexpected delete holiday error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not delete holiday",
      });
    }
  }
);

/* =========================================================
   SHIFTS
========================================================= */

/*
   GET /api/shift-holiday/shifts
*/

router.get(
  "/shifts",
  async (req, res) => {
    try {
      const {
        location_id,
      } = req.query;

      let query =
        supabaseAdmin
          .from("organization_shifts")
          .select(
            `
              *,
              organization_locations (
                id,
                name,
                country
              )
            `
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .order("name", {
            ascending: true,
          });

      if (location_id) {
        if (
          !isValidUUID(location_id)
        ) {
          return res.status(400).json({
            message:
              "Invalid location ID",
          });
        }

        query = query.eq(
          "location_id",
          location_id
        );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Load shifts error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load shifts",
          detail: error.message,
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Unexpected shifts error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load shifts",
      });
    }
  }
);

/*
   POST /api/shift-holiday/shifts
*/

router.post(
  "/shifts",
  async (req, res) => {
    try {
      const {
        name,
        start_time,
        startTime,
        end_time,
        endTime,
        location_id,
        working_days,
        workingDays,
      } = req.body || {};

      const cleanedName =
        cleanString(name);

      const startTimeValue =
        cleanString(
          start_time || startTime
        );

      const endTimeValue =
        cleanString(
          end_time || endTime
        );

      const workingDaysValue =
        normalizeWorkingDays(
          working_days ||
            workingDays
        );

      if (!cleanedName) {
        return res.status(400).json({
          message:
            "Shift name is required",
        });
      }

      if (
        !isValidTime(
          startTimeValue
        )
      ) {
        return res.status(400).json({
          message:
            "Valid start time is required",
        });
      }

      if (
        !isValidTime(
          endTimeValue
        )
      ) {
        return res.status(400).json({
          message:
            "Valid end time is required",
        });
      }

      if (
        !location_id ||
        !isValidUUID(location_id)
      ) {
        return res.status(400).json({
          message:
            "Valid location is required",
        });
      }

      if (
        workingDaysValue.length === 0
      ) {
        return res.status(400).json({
          message:
            "At least one working day is required",
        });
      }

      const {
        data: location,
        error:
          locationError,
      } = await supabaseAdmin
        .from("organization_locations")
        .select("id")
        .eq(
          "id",
          location_id
        )
        .eq(
          "organization_id",
          req.organization.id
        )
        .maybeSingle();

      if (locationError) {
        return res.status(500).json({
          message:
            "Could not verify location",
          detail:
            locationError.message,
        });
      }

      if (!location) {
        return res.status(404).json({
          message:
            "Location not found in your organization",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_shifts")
        .insert({
          organization_id:
            req.organization.id,

          location_id,

          name: cleanedName,

          start_time:
            startTimeValue,

          end_time:
            endTimeValue,

          working_days:
            workingDaysValue,
        })
        .select(
          `
            *,
            organization_locations (
              id,
              name,
              country
            )
          `
        )
        .single();

      if (error) {
        console.error(
          "Create shift error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not create shift",
          detail: error.message,
        });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error(
        "Unexpected create shift error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not create shift",
      });
    }
  }
);

/*
   PUT /api/shift-holiday/shifts/:id
*/

router.put(
  "/shifts/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({
          message:
            "Invalid shift ID",
        });
      }

      const {
        name,
        start_time,
        startTime,
        end_time,
        endTime,
        location_id,
        working_days,
        workingDays,
      } = req.body || {};

      const cleanedName =
        cleanString(name);

      const startTimeValue =
        cleanString(
          start_time || startTime
        );

      const endTimeValue =
        cleanString(
          end_time || endTime
        );

      const workingDaysValue =
        normalizeWorkingDays(
          working_days ||
            workingDays
        );

      if (!cleanedName) {
        return res.status(400).json({
          message:
            "Shift name is required",
        });
      }

      if (
        !isValidTime(
          startTimeValue
        )
      ) {
        return res.status(400).json({
          message:
            "Valid start time is required",
        });
      }

      if (
        !isValidTime(
          endTimeValue
        )
      ) {
        return res.status(400).json({
          message:
            "Valid end time is required",
        });
      }

      if (
        !location_id ||
        !isValidUUID(location_id)
      ) {
        return res.status(400).json({
          message:
            "Valid location is required",
        });
      }

      if (
        workingDaysValue.length === 0
      ) {
        return res.status(400).json({
          message:
            "At least one working day is required",
        });
      }

      const {
        data: location,
        error:
          locationError,
      } = await supabaseAdmin
        .from("organization_locations")
        .select("id")
        .eq(
          "id",
          location_id
        )
        .eq(
          "organization_id",
          req.organization.id
        )
        .maybeSingle();

      if (locationError) {
        return res.status(500).json({
          message:
            "Could not verify location",
          detail:
            locationError.message,
        });
      }

      if (!location) {
        return res.status(404).json({
          message:
            "Location not found in your organization",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_shifts")
        .update({
          name: cleanedName,

          start_time:
            startTimeValue,

          end_time:
            endTimeValue,

          location_id,

          working_days:
            workingDaysValue,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id)
        .eq(
          "organization_id",
          req.organization.id
        )
        .select(
          `
            *,
            organization_locations (
              id,
              name,
              country
            )
          `
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Update shift error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not update shift",
          detail: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Shift not found",
        });
      }

      return res.json(data);
    } catch (error) {
      console.error(
        "Unexpected update shift error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not update shift",
      });
    }
  }
);

/*
   DELETE /api/shift-holiday/shifts/:id
*/

router.delete(
  "/shifts/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({
          message:
            "Invalid shift ID",
        });
      }

      const {
        count,
        error:
          assignmentCheckError,
      } = await supabaseAdmin
        .from(
          "employee_shift_assignments"
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "organization_id",
          req.organization.id
        )
        .eq(
          "shift_id",
          id
        );

      if (assignmentCheckError) {
        return res.status(500).json({
          message:
            "Could not check shift assignments",
          detail:
            assignmentCheckError.message,
        });
      }

      if ((count || 0) > 0) {
        return res.status(409).json({
          message:
            "This shift is assigned to employees. Reassign those employees before deleting the shift.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("organization_shifts")
        .delete()
        .eq("id", id)
        .eq(
          "organization_id",
          req.organization.id
        )
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          "Delete shift error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not delete shift",
          detail: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Shift not found",
        });
      }

      return res.json({
        message:
          "Shift deleted successfully",
      });
    } catch (error) {
      console.error(
        "Unexpected delete shift error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not delete shift",
      });
    }
  }
);

/* =========================================================
   EMPLOYEE SHIFT ASSIGNMENTS
========================================================= */

/*
   GET /api/shift-holiday/assignments
*/

router.get(
  "/assignments",
  async (req, res) => {
    try {
      const {
        employee_id,
      } = req.query;

      let query =
        supabaseAdmin
          .from(
            "employee_shift_assignments"
          )
          .select(
            `
              *,
              employees (
                id,
                full_name,
                email,
                department,
                title,
                employee_code
              ),
              organization_shifts (
                id,
                name,
                start_time,
                end_time,
                working_days,
                location_id
              )
            `
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .order("created_at", {
            ascending: false,
          });

      if (employee_id) {
        if (
          !isValidUUID(employee_id)
        ) {
          return res.status(400).json({
            message:
              "Invalid employee ID",
          });
        }

        query = query.eq(
          "employee_id",
          employee_id
        );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Load assignments error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load employee shift assignments",
          detail: error.message,
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Unexpected assignments error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load employee shift assignments",
      });
    }
  }
);

/*
   POST /api/shift-holiday/assignments
*/

router.post(
  "/assignments",
  async (req, res) => {
    try {
      const {
        employee_id,
        shift_id,
      } = req.body || {};

      if (
        !employee_id ||
        !isValidUUID(employee_id)
      ) {
        return res.status(400).json({
          message:
            "Valid employee is required",
        });
      }

      if (
        !shift_id ||
        !isValidUUID(shift_id)
      ) {
        return res.status(400).json({
          message:
            "Valid shift is required",
        });
      }

      const {
        data: employee,
        error:
          employeeError,
      } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq(
          "id",
          employee_id
        )
        .eq(
          "organization_id",
          req.organization.id
        )
        .maybeSingle();

      if (employeeError) {
        return res.status(500).json({
          message:
            "Could not verify employee",
          detail:
            employeeError.message,
        });
      }

      if (!employee) {
        return res.status(404).json({
          message:
            "Employee not found in your organization",
        });
      }

      const {
        data: shift,
        error:
          shiftError,
      } = await supabaseAdmin
        .from("organization_shifts")
        .select("id")
        .eq(
          "id",
          shift_id
        )
        .eq(
          "organization_id",
          req.organization.id
        )
        .maybeSingle();

      if (shiftError) {
        return res.status(500).json({
          message:
            "Could not verify shift",
          detail:
            shiftError.message,
        });
      }

      if (!shift) {
        return res.status(404).json({
          message:
            "Shift not found in your organization",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "employee_shift_assignments"
        )
        .upsert(
          {
            organization_id:
              req.organization.id,

            employee_id,

            shift_id,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "employee_id",
          }
        )
        .select(
          `
            *,
            employees (
              id,
              full_name,
              email,
              department,
              title,
              employee_code
            ),
            organization_shifts (
              id,
              name,
              start_time,
              end_time,
              working_days,
              location_id
            )
          `
        )
        .single();

      if (error) {
        console.error(
          "Save shift assignment error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not save employee shift assignment",
          detail: error.message,
        });
      }

      return res.json(data);
    } catch (error) {
      console.error(
        "Unexpected assignment save error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not save employee shift assignment",
      });
    }
  }
);

/*
   DELETE /api/shift-holiday/assignments/:id
*/

router.delete(
  "/assignments/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({
          message:
            "Invalid assignment ID",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "employee_shift_assignments"
        )
        .delete()
        .eq("id", id)
        .eq(
          "organization_id",
          req.organization.id
        )
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          "Delete shift assignment error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not delete employee shift assignment",
          detail: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Shift assignment not found",
        });
      }

      return res.json({
        message:
          "Employee shift assignment deleted successfully",
      });
    } catch (error) {
      console.error(
        "Unexpected assignment delete error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not delete employee shift assignment",
      });
    }
  }
);

export default router;