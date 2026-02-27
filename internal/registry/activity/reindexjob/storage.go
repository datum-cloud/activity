package reindexjob

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/duration"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"go.miloapis.com/activity/pkg/apis/activity"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// ReindexJobStorage implements a RESTStorage for ReindexJob.
type ReindexJobStorage struct {
	*genericregistry.Store
}

// ReindexJobStatusStorage implements the REST endpoint for updating ReindexJob status.
type ReindexJobStatusStorage struct {
	store *genericregistry.Store
}

// New creates a new ReindexJob object.
func (s *ReindexJobStatusStorage) New() runtime.Object {
	return &activity.ReindexJob{}
}

// Destroy cleans up resources on shutdown.
func (s *ReindexJobStatusStorage) Destroy() {
	// No-op: the store is shared with the main REST storage
}

// Get retrieves the object from the storage.
func (s *ReindexJobStatusStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.store.Get(ctx, name, options)
}

// Update alters the status subset of an object.
func (s *ReindexJobStatusStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return s.store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

// reindexJobTableConvertor implements rest.TableConvertor for ReindexJob.
type reindexJobTableConvertor struct{}

var _ rest.TableConvertor = &reindexJobTableConvertor{}

// ConvertToTable converts ReindexJob objects to table format for kubectl display.
func (c *reindexJobTableConvertor) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	table := &metav1.Table{
		ColumnDefinitions: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Description: "Job name"},
			{Name: "Phase", Type: "string", Description: "Current phase (Pending, Running, Succeeded, Failed)"},
			{Name: "Time Range", Type: "string", Description: "Re-indexing time range"},
			{Name: "Progress", Type: "string", Description: "Processing progress percentage"},
			{Name: "Age", Type: "string", Description: "Time since job was created"},
		},
	}

	switch t := object.(type) {
	case *activity.ReindexJob:
		table.Rows = append(table.Rows, reindexJobToTableRow(t))
	case *activity.ReindexJobList:
		for i := range t.Items {
			table.Rows = append(table.Rows, reindexJobToTableRow(&t.Items[i]))
		}
	}

	return table, nil
}

// reindexJobToTableRow converts a ReindexJob to a table row.
func reindexJobToTableRow(job *activity.ReindexJob) metav1.TableRow {
	// Format time range
	timeRange := job.Spec.TimeRange.StartTime.Format("2006-01-02 15:04")
	if job.Spec.TimeRange.EndTime != nil {
		timeRange = fmt.Sprintf("%s to %s", timeRange, job.Spec.TimeRange.EndTime.Format("2006-01-02 15:04"))
	} else {
		timeRange = fmt.Sprintf("%s to now", timeRange)
	}

	// Format progress
	progress := "-"
	if job.Status.Progress != nil {
		if job.Status.Progress.TotalEvents > 0 {
			percentage := float64(job.Status.Progress.ProcessedEvents) / float64(job.Status.Progress.TotalEvents) * 100
			progress = fmt.Sprintf("%.0f%%", percentage)
		} else if job.Status.Progress.ProcessedEvents > 0 {
			// If total is unknown but we've processed events, show the count
			progress = fmt.Sprintf("%d events", job.Status.Progress.ProcessedEvents)
		}
	}

	// Calculate age
	age := "<unknown>"
	if !job.CreationTimestamp.IsZero() {
		age = duration.HumanDuration(metav1.Now().Sub(job.CreationTimestamp.Time))
	}

	// Get phase
	phase := string(job.Status.Phase)
	if phase == "" {
		phase = "Pending"
	}

	return metav1.TableRow{
		Object: runtime.RawExtension{Object: job},
		Cells: []interface{}{
			job.Name,
			phase,
			timeRange,
			progress,
			age,
		},
	}
}

// NewStorage creates a new REST storage for ReindexJob backed by etcd.
// It returns both the main storage and the status subresource storage.
func NewStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*ReindexJobStorage, *ReindexJobStatusStorage, error) {
	strategy := NewStrategy(scheme)
	statusStrategy := NewStatusStrategy(scheme)

	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &activity.ReindexJob{} },
		NewListFunc:               func() runtime.Object { return &activity.ReindexJobList{} },
		DefaultQualifiedResource:  v1alpha1.Resource("reindexjobs"),
		SingularQualifiedResource: v1alpha1.Resource("reindexjob"),

		CreateStrategy: strategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,

		TableConvertor: &reindexJobTableConvertor{},
	}

	options := &generic.StoreOptions{
		RESTOptions: optsGetter,
		AttrFunc:    GetAttrs,
	}

	if err := store.CompleteWithOptions(options); err != nil {
		return nil, nil, err
	}

	// Create a copy of the store for status updates with the status strategy
	statusStore := *store
	statusStore.UpdateStrategy = statusStrategy
	statusStore.ResetFieldsStrategy = statusStrategy

	return &ReindexJobStorage{store}, &ReindexJobStatusStorage{store: &statusStore}, nil
}
