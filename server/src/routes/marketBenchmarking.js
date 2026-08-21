import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

router.use(requireAuth);

/* =========================================================
   ORGANIZATION CHECK
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id,
    );

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "Market benchmarking organization lookup error:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validateBenchmarkPayload(body) {
  const {
    job_family,
    job_title,
    level,
    market_minimum,
    market_median,
    market_maximum,
  } = body;

  if (!job_family?.trim()) {
    return "Job family is required";
  }

  if (!job_title?.trim()) {
    return "Job title is required";
  }

  if (!level?.trim()) {
    return "Level is required";
  }

  const minimum = Number(market_minimum);
  const median = Number(market_median);
  const maximum = Number(market_maximum);

  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(median) ||
    !Number.isFinite(maximum)
  ) {
    return "Market minimum, median and maximum must be valid numbers";
  }

  if (
    minimum < 0 ||
    median < minimum ||
    maximum < median
  ) {
    return "Market range must satisfy Minimum ≤ Median ≤ Maximum";
  }

  return null;
}

/* =========================================================
   GET ALL MARKET BENCHMARKS
   GET /api/market-benchmarking
========================================================= */

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("market_benchmarks")
      .select("*")
      .eq(
        "organization_id",
        req.organization.id,
      )
      .order("job_family", {
        ascending: true,
      })
      .order("job_title", {
        ascending: true,
      })
      .order("level", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Load market benchmarks error:",
        error,
      );

      return res.status(500).json({
        message: "Could not load market benchmarks",
        detail: error.message,
      });
    }

    return res.json(data || []);
  } catch (error) {
    console.error(
      "Market benchmarking GET error:",
      error,
    );

    return res.status(500).json({
      message: "Could not load market benchmarks",
    });
  }
});

/* =========================================================
   GET SINGLE MARKET BENCHMARK
   GET /api/market-benchmarking/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("market_benchmarks")
      .select("*")
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        req.organization.id,
      )
      .single();

    if (error || !data) {
      return res.status(404).json({
        message: "Market benchmark not found",
      });
    }

    return res.json(data);
  } catch (error) {
    console.error(
      "Market benchmark GET by ID error:",
      error,
    );

    return res.status(500).json({
      message: "Could not load market benchmark",
    });
  }
});

/* =========================================================
   CREATE MARKET BENCHMARK
   POST /api/market-benchmarking
========================================================= */

router.post("/", async (req, res) => {
  try {
    const validationError =
      validateBenchmarkPayload(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const {
      job_family,
      job_title,
      level,
      location,
      currency,
      market_minimum,
      market_median,
      market_maximum,
      source,
      effective_date,
      notes,
    } = req.body;

    const minimum = Number(market_minimum);
    const median = Number(market_median);
    const maximum = Number(market_maximum);

    const { data, error } = await supabaseAdmin
      .from("market_benchmarks")
      .insert({
        organization_id:
          req.organization.id,

        job_family:
          job_family.trim(),

        job_title:
          job_title.trim(),

        level:
          level.trim(),

        location:
          location?.trim() || null,

        currency:
          currency?.trim() || "INR",

        market_minimum:
          minimum,

        market_median:
          median,

        market_maximum:
          maximum,

        source:
          source?.trim() || null,

        effective_date:
          effective_date || null,

        notes:
          notes?.trim() || null,

        created_by:
          req.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Create market benchmark error:",
        error,
      );

      return res.status(500).json({
        message: "Could not create market benchmark",
        detail: error.message,
      });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error(
      "Market benchmark POST error:",
      error,
    );

    return res.status(500).json({
      message: "Could not create market benchmark",
    });
  }
});

/* =========================================================
   UPDATE MARKET BENCHMARK
   PUT /api/market-benchmarking/:id
========================================================= */

router.put("/:id", async (req, res) => {
  try {
    const validationError =
      validateBenchmarkPayload(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const {
      job_family,
      job_title,
      level,
      location,
      currency,
      market_minimum,
      market_median,
      market_maximum,
      source,
      effective_date,
      notes,
    } = req.body;

    const minimum = Number(market_minimum);
    const median = Number(market_median);
    const maximum = Number(market_maximum);

    const { data, error } = await supabaseAdmin
      .from("market_benchmarks")
      .update({
        job_family:
          job_family.trim(),

        job_title:
          job_title.trim(),

        level:
          level.trim(),

        location:
          location?.trim() || null,

        currency:
          currency?.trim() || "INR",

        market_minimum:
          minimum,

        market_median:
          median,

        market_maximum:
          maximum,

        source:
          source?.trim() || null,

        effective_date:
          effective_date || null,

        notes:
          notes?.trim() || null,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        req.params.id,
      )
      .eq(
        "organization_id",
        req.organization.id,
      )
      .select()
      .single();

    if (error || !data) {
      console.error(
        "Update market benchmark error:",
        error,
      );

      return res.status(
        error ? 500 : 404,
      ).json({
        message: error
          ? "Could not update market benchmark"
          : "Market benchmark not found",
        ...(error && {
          detail: error.message,
        }),
      });
    }

    return res.json(data);
  } catch (error) {
    console.error(
      "Market benchmark PUT error:",
      error,
    );

    return res.status(500).json({
      message: "Could not update market benchmark",
    });
  }
});

/* =========================================================
   DELETE MARKET BENCHMARK
   DELETE /api/market-benchmarking/:id
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("market_benchmarks")
      .delete()
      .eq(
        "id",
        req.params.id,
      )
      .eq(
        "organization_id",
        req.organization.id,
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error(
        "Delete market benchmark error:",
        error,
      );

      return res.status(500).json({
        message: "Could not delete market benchmark",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message: "Market benchmark not found",
      });
    }

    return res.json({
      message:
        "Market benchmark deleted successfully",
    });
  } catch (error) {
    console.error(
      "Market benchmark DELETE error:",
      error,
    );

    return res.status(500).json({
      message: "Could not delete market benchmark",
    });
  }
});

/* =========================================================
   COMPARE MARKET BENCHMARKS WITH PAY BANDS

   GET /api/market-benchmarking/compare/pay-bands

   STATUS RULES

   Internal midpoint is compared with market median.

   <= -10%  = BELOW MARKET
   > -10%
   < +10%   = NEAR MARKET
   >= +10%  = ABOVE MARKET
========================================================= */

router.get(
  "/compare/pay-bands",
  async (req, res) => {
    try {
      const {
        data: benchmarks,
        error: benchmarkError,
      } = await supabaseAdmin
        .from("market_benchmarks")
        .select("*")
        .eq(
          "organization_id",
          req.organization.id,
        )
        .order("job_family", {
          ascending: true,
        })
        .order("level", {
          ascending: true,
        });

      if (benchmarkError) {
        console.error(
          "Load benchmarks for comparison error:",
          benchmarkError,
        );

        return res.status(500).json({
          message:
            "Could not load market benchmarks",
          detail:
            benchmarkError.message,
        });
      }

      const {
        data: payBands,
        error: payBandError,
      } = await supabaseAdmin
        .from("pay_bands")
        .select("*")
        .eq(
          "organization_id",
          req.organization.id,
        )
        .order("job_family", {
          ascending: true,
        })
        .order("level", {
          ascending: true,
        });

      if (payBandError) {
        console.error(
          "Load pay bands for comparison error:",
          payBandError,
        );

        return res.status(500).json({
          message:
            "Could not load pay bands",
          detail:
            payBandError.message,
        });
      }

      const results = [];

      let belowMarketCount = 0;
      let nearMarketCount = 0;
      let aboveMarketCount = 0;
      let noInternalBandCount = 0;

      for (const benchmark of benchmarks || []) {
        const matchingBands =
          (payBands || []).filter(
            (band) =>
              normalize(
                band.job_family,
              ) ===
                normalize(
                  benchmark.job_family,
                ) &&
              normalize(
                band.level,
              ) ===
                normalize(
                  benchmark.level,
                ),
          );

        if (matchingBands.length === 0) {
          noInternalBandCount += 1;

          results.push({
            benchmark,

            pay_band: null,

            status:
              "no_internal_band",

            status_label:
              "No internal band",

            midpoint_difference:
              null,

            midpoint_difference_percent:
              null,

            market_median:
              Number(
                benchmark.market_median,
              ),

            internal_midpoint:
              null,
          });

          continue;
        }

        for (const band of matchingBands) {
          const internalMinimum =
            Number(
              band.minimum,
            );

          const internalMidpoint =
            Number(
              band.midpoint,
            );

          const internalMaximum =
            Number(
              band.maximum,
            );

          const marketMinimum =
            Number(
              benchmark.market_minimum,
            );

          const marketMedian =
            Number(
              benchmark.market_median,
            );

          const marketMaximum =
            Number(
              benchmark.market_maximum,
            );

          const difference =
            internalMidpoint -
            marketMedian;

          const percentage =
            marketMedian > 0
              ? (difference /
                  marketMedian) *
                100
              : null;

          let status =
            "near_market";

          let statusLabel =
            "Near market";

          if (
            percentage !== null &&
            percentage <= -10
          ) {
            status =
              "below_market";

            statusLabel =
              "Below market";

            belowMarketCount += 1;
          } else if (
            percentage !== null &&
            percentage >= 10
          ) {
            status =
              "above_market";

            statusLabel =
              "Above market";

            aboveMarketCount += 1;
          } else {
            nearMarketCount += 1;
          }

          results.push({
            benchmark,

            pay_band:
              band,

            status,

            status_label:
              statusLabel,

            midpoint_difference:
              Number(
                difference.toFixed(2),
              ),

            midpoint_difference_percent:
              percentage === null
                ? null
                : Number(
                    percentage.toFixed(2),
                  ),

            market_minimum:
              marketMinimum,

            market_median:
              marketMedian,

            market_maximum:
              marketMaximum,

            internal_minimum:
              internalMinimum,

            internal_midpoint:
              internalMidpoint,

            internal_maximum:
              internalMaximum,
          });
        }
      }

      return res.json({
        total_benchmarks:
          (benchmarks || []).length,

        total_pay_bands:
          (payBands || []).length,

        below_market:
          belowMarketCount,

        near_market:
          nearMarketCount,

        above_market:
          aboveMarketCount,

        no_internal_band:
          noInternalBandCount,

        comparisons:
          results,
      });
    } catch (error) {
      console.error(
        "Market benchmarking comparison error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not compare market benchmarks with pay bands",

        detail:
          error.message,
      });
    }
  },
);

/* =========================================================
   SUMMARY
   GET /api/market-benchmarking/summary
========================================================= */

router.get(
  "/summary",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("market_benchmarks")
        .select(
          "id, job_family, job_title, level, market_median",
        )
        .eq(
          "organization_id",
          req.organization.id,
        );

      if (error) {
        console.error(
          "Market benchmarking summary error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not load market benchmarking summary",

          detail:
            error.message,
        });
      }

      const benchmarks =
        data || [];

      const jobFamilies =
        new Set(
          benchmarks
            .map(
              (item) =>
                item.job_family,
            )
            .filter(Boolean),
        );

      const levels =
        new Set(
          benchmarks
            .map(
              (item) =>
                item.level,
            )
            .filter(Boolean),
        );

      const jobTitles =
        new Set(
          benchmarks
            .map(
              (item) =>
                item.job_title,
            )
            .filter(Boolean),
        );

      return res.json({
        total_benchmarks:
          benchmarks.length,

        job_families:
          jobFamilies.size,

        levels:
          levels.size,

        benchmarked_jobs:
          jobTitles.size,
      });
    } catch (error) {
      console.error(
        "Market benchmarking summary GET error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load market benchmarking summary",
      });
    }
  },
);

export default router;