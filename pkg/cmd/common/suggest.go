package common

import (
	"context"
	"fmt"
	"io"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/cli-runtime/pkg/printers"

	activityv1alpha1 "go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
	clientset "go.miloapis.com/activity/pkg/client/clientset/versioned"
)

// PrintAuditLogFacets executes and prints an audit log facet query
func PrintAuditLogFacets(ctx context.Context, client *clientset.Clientset, field, startTime, endTime, filter string, out io.Writer) error {
	query := &activityv1alpha1.AuditLogFacetsQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "facets-",
		},
		Spec: activityv1alpha1.AuditLogFacetsQuerySpec{
			TimeRange: activityv1alpha1.FacetTimeRange{
				Start: startTime,
				End:   endTime,
			},
			Filter: filter,
			Facets: []activityv1alpha1.FacetSpec{
				{
					Field: field,
					Limit: 20,
				},
			},
		},
	}

	result, err := client.ActivityV1alpha1().AuditLogFacetsQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("facet query failed: %w", err)
	}

	if len(result.Status.Facets) == 0 {
		fmt.Fprintf(out, "No values found for field: %s\n", field)
		return nil
	}

	facet := result.Status.Facets[0]
	return PrintFacetTable(facet, out)
}

// PrintEventFacets executes and prints an event facet query
func PrintEventFacets(ctx context.Context, client *clientset.Clientset, field, startTime, endTime string, out io.Writer) error {
	query := &activityv1alpha1.EventFacetQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "facets-",
		},
		Spec: activityv1alpha1.EventFacetQuerySpec{
			TimeRange: activityv1alpha1.FacetTimeRange{
				Start: startTime,
				End:   endTime,
			},
			Facets: []activityv1alpha1.FacetSpec{
				{
					Field: field,
					Limit: 20,
				},
			},
		},
	}

	result, err := client.ActivityV1alpha1().EventFacetQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("facet query failed: %w", err)
	}

	if len(result.Status.Facets) == 0 {
		fmt.Fprintf(out, "No values found for field: %s\n", field)
		return nil
	}

	facet := result.Status.Facets[0]
	return PrintFacetTable(facet, out)
}

// PrintActivityFacets executes and prints an activity facet query
func PrintActivityFacets(ctx context.Context, client *clientset.Clientset, field, startTime, endTime, filter string, out io.Writer) error {
	query := &activityv1alpha1.ActivityFacetQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "facets-",
		},
		Spec: activityv1alpha1.ActivityFacetQuerySpec{
			TimeRange: activityv1alpha1.FacetTimeRange{
				Start: startTime,
				End:   endTime,
			},
			Filter: filter,
			Facets: []activityv1alpha1.FacetSpec{
				{
					Field: field,
					Limit: 20,
				},
			},
		},
	}

	result, err := client.ActivityV1alpha1().ActivityFacetQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("facet query failed: %w", err)
	}

	if len(result.Status.Facets) == 0 {
		fmt.Fprintf(out, "No values found for field: %s\n", field)
		return nil
	}

	facet := result.Status.Facets[0]
	return PrintFacetTable(facet, out)
}

// PrintFacetTable prints a facet result as a table
func PrintFacetTable(facet activityv1alpha1.FacetResult, out io.Writer) error {
	fmt.Fprintf(out, "FIELD: %s\n", facet.Field)

	table := &metav1.Table{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Table",
			APIVersion: "meta.k8s.io/v1",
		},
		ColumnDefinitions: []metav1.TableColumnDefinition{
			{Name: "Value", Type: "string", Description: "Distinct value"},
			{Name: "Count", Type: "integer", Description: "Number of occurrences"},
		},
		Rows: make([]metav1.TableRow, 0, len(facet.Values)),
	}

	for _, v := range facet.Values {
		table.Rows = append(table.Rows, metav1.TableRow{
			Cells: []interface{}{v.Value, v.Count},
		})
	}

	tablePrinter := printers.NewTablePrinter(printers.PrintOptions{
		WithNamespace: false,
		Wide:          true,
	})

	return tablePrinter.PrintObj(table, out)
}
