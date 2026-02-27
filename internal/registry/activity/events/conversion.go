package events

import (
	corev1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ConvertCoreV1ToEventsV1 converts a core/v1 Event to an events.k8s.io/v1 Event.
func ConvertCoreV1ToEventsV1(coreEvent *corev1.Event) *eventsv1.Event {
	if coreEvent == nil {
		return nil
	}

	v1Event := &eventsv1.Event{
		ObjectMeta: coreEvent.ObjectMeta,
		Regarding: corev1.ObjectReference{
			Kind:            coreEvent.InvolvedObject.Kind,
			Namespace:       coreEvent.InvolvedObject.Namespace,
			Name:            coreEvent.InvolvedObject.Name,
			UID:             coreEvent.InvolvedObject.UID,
			APIVersion:      coreEvent.InvolvedObject.APIVersion,
			ResourceVersion: coreEvent.InvolvedObject.ResourceVersion,
			FieldPath:       coreEvent.InvolvedObject.FieldPath,
		},
		Reason:              coreEvent.Reason,
		Note:                coreEvent.Message,
		Type:                coreEvent.Type,
		DeprecatedCount:     coreEvent.Count,
		Action:              "Event",
		ReportingController: coreEvent.Source.Component,
		ReportingInstance:   coreEvent.Source.Host,
	}

	// Handle timestamps
	if !coreEvent.FirstTimestamp.Time.IsZero() {
		v1Event.EventTime = metav1.NewMicroTime(coreEvent.FirstTimestamp.Time)
		v1Event.DeprecatedFirstTimestamp = coreEvent.FirstTimestamp
	}
	if !coreEvent.LastTimestamp.Time.IsZero() {
		v1Event.DeprecatedLastTimestamp = coreEvent.LastTimestamp
		if coreEvent.Count > 1 {
			v1Event.Series = &eventsv1.EventSeries{
				Count:            coreEvent.Count,
				LastObservedTime: metav1.NewMicroTime(coreEvent.LastTimestamp.Time),
			}
		}
	}

	// Handle related object
	if coreEvent.Related != nil {
		v1Event.Related = &corev1.ObjectReference{
			Kind:            coreEvent.Related.Kind,
			Namespace:       coreEvent.Related.Namespace,
			Name:            coreEvent.Related.Name,
			UID:             coreEvent.Related.UID,
			APIVersion:      coreEvent.Related.APIVersion,
			ResourceVersion: coreEvent.Related.ResourceVersion,
			FieldPath:       coreEvent.Related.FieldPath,
		}
	}

	return v1Event
}

// ConvertEventsV1ToCoreV1 converts an events.k8s.io/v1 Event to a core/v1 Event.
func ConvertEventsV1ToCoreV1(v1Event *eventsv1.Event) *corev1.Event {
	if v1Event == nil {
		return nil
	}

	coreEvent := &corev1.Event{
		ObjectMeta: v1Event.ObjectMeta,
		InvolvedObject: corev1.ObjectReference{
			Kind:            v1Event.Regarding.Kind,
			Namespace:       v1Event.Regarding.Namespace,
			Name:            v1Event.Regarding.Name,
			UID:             v1Event.Regarding.UID,
			APIVersion:      v1Event.Regarding.APIVersion,
			ResourceVersion: v1Event.Regarding.ResourceVersion,
			FieldPath:       v1Event.Regarding.FieldPath,
		},
		Reason:  v1Event.Reason,
		Message: v1Event.Note,
		Type:    v1Event.Type,
		Count:   v1Event.DeprecatedCount,
	}

	// Handle source
	if v1Event.ReportingController != "" {
		coreEvent.Source.Component = v1Event.ReportingController
	}
	if v1Event.ReportingInstance != "" {
		coreEvent.Source.Host = v1Event.ReportingInstance
	}

	// Handle timestamps
	if v1Event.EventTime.Time.IsZero() {
		// Use deprecated fields if new ones are not set
		coreEvent.FirstTimestamp = v1Event.DeprecatedFirstTimestamp
		coreEvent.LastTimestamp = v1Event.DeprecatedLastTimestamp
	} else {
		// Convert MicroTime to Time
		coreEvent.FirstTimestamp = metav1.NewTime(v1Event.EventTime.Time)
		coreEvent.LastTimestamp = metav1.NewTime(v1Event.EventTime.Time)
		if v1Event.Series != nil {
			coreEvent.LastTimestamp = metav1.NewTime(v1Event.Series.LastObservedTime.Time)
			coreEvent.Count = v1Event.Series.Count
		}
	}

	// Handle related object
	if v1Event.Related != nil {
		coreEvent.Related = &corev1.ObjectReference{
			Kind:            v1Event.Related.Kind,
			Namespace:       v1Event.Related.Namespace,
			Name:            v1Event.Related.Name,
			UID:             v1Event.Related.UID,
			APIVersion:      v1Event.Related.APIVersion,
			ResourceVersion: v1Event.Related.ResourceVersion,
			FieldPath:       v1Event.Related.FieldPath,
		}
	}

	return coreEvent
}

// ConvertCoreV1EventListToEventsV1 converts a core/v1 EventList to an events.k8s.io/v1 EventList.
func ConvertCoreV1EventListToEventsV1(coreList *corev1.EventList) *eventsv1.EventList {
	if coreList == nil {
		return nil
	}

	v1List := &eventsv1.EventList{
		ListMeta: coreList.ListMeta,
		Items:    make([]eventsv1.Event, len(coreList.Items)),
	}

	for i := range coreList.Items {
		converted := ConvertCoreV1ToEventsV1(&coreList.Items[i])
		if converted != nil {
			v1List.Items[i] = *converted
		}
	}

	return v1List
}

// ConvertEventsV1EventListToCoreV1 converts an events.k8s.io/v1 EventList to a core/v1 EventList.
func ConvertEventsV1EventListToCoreV1(v1List *eventsv1.EventList) *corev1.EventList {
	if v1List == nil {
		return nil
	}

	coreList := &corev1.EventList{
		ListMeta: v1List.ListMeta,
		Items:    make([]corev1.Event, len(v1List.Items)),
	}

	for i := range v1List.Items {
		converted := ConvertEventsV1ToCoreV1(&v1List.Items[i])
		if converted != nil {
			coreList.Items[i] = *converted
		}
	}

	return coreList
}
