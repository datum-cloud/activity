package reindex

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// reindexJobsTotal tracks the total number of reindex jobs started
	reindexJobsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_reindex",
			Name:      "jobs_total",
			Help:      "Total number of reindex jobs started",
		},
		[]string{"time_range", "policy"},
	)

	// reindexEventsProcessed tracks the total number of source events processed
	reindexEventsProcessed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_reindex",
			Name:      "events_processed_total",
			Help:      "Total number of source events processed during reindexing",
		},
		[]string{"source_type", "policy", "dry_run"},
	)

	// reindexActivitiesGenerated tracks the total number of activities generated
	reindexActivitiesGenerated = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_reindex",
			Name:      "activities_generated_total",
			Help:      "Total number of activities generated during reindexing",
		},
		[]string{"policy", "dry_run"},
	)

	// reindexActivitiesPublished tracks the total number of activities published to NATS
	reindexActivitiesPublished = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_reindex",
			Name:      "activities_published_total",
			Help:      "Total number of activities published to NATS",
		},
		[]string{"policy"},
	)

	// reindexErrors tracks the total number of errors encountered
	reindexErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_reindex",
			Name:      "errors_total",
			Help:      "Total number of errors encountered during reindexing",
		},
		[]string{"error_type"},
	)

	// reindexDuration tracks time spent on reindex jobs
	reindexDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "activity_reindex",
			Name:      "job_duration_seconds",
			Help:      "Time spent on reindex jobs",
			Buckets:   prometheus.ExponentialBuckets(10, 2, 10), // 10s to ~2.8 hours
		},
		[]string{"time_range"},
	)

	// reindexBatchDuration tracks time spent processing each batch
	reindexBatchDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Namespace: "activity_reindex",
			Name:      "batch_duration_seconds",
			Help:      "Time spent processing each batch",
			Buckets:   prometheus.DefBuckets,
		},
	)
)
