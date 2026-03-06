package controller

import (
	"context"
	"fmt"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/yaml"
)

const (
	// ReindexContainerName is the name of the main container in the Job template.
	ReindexContainerName = "reindex"

	// JobTemplateConfigMapKey is the key in the ConfigMap containing the template.
	JobTemplateConfigMapKey = "template.yaml"
)

// LoadJobTemplate loads a PodTemplateSpec from a ConfigMap.
// The ConfigMap should contain a "template.yaml" key with a PodTemplateSpec.
func LoadJobTemplate(ctx context.Context, c client.Client, namespace, name string) (*corev1.PodTemplateSpec, error) {
	var cm corev1.ConfigMap
	if err := c.Get(ctx, client.ObjectKey{Namespace: namespace, Name: name}, &cm); err != nil {
		return nil, fmt.Errorf("failed to get job template ConfigMap %s/%s: %w", namespace, name, err)
	}

	templateData, ok := cm.Data[JobTemplateConfigMapKey]
	if !ok {
		return nil, fmt.Errorf("ConfigMap %s/%s does not contain key %q", namespace, name, JobTemplateConfigMapKey)
	}

	var template corev1.PodTemplateSpec
	if err := yaml.Unmarshal([]byte(templateData), &template); err != nil {
		return nil, fmt.Errorf("failed to parse job template from ConfigMap %s/%s: %w", namespace, name, err)
	}

	return &template, nil
}

// DefaultJobTemplate returns the minimal default PodTemplateSpec when no ConfigMap is provided.
// This maintains backward compatibility with deployments that don't use a template ConfigMap.
func DefaultJobTemplate() *corev1.PodTemplateSpec {
	return &corev1.PodTemplateSpec{
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyOnFailure,
			SecurityContext: &corev1.PodSecurityContext{
				RunAsNonRoot: ptr.To(true),
				RunAsUser:    ptr.To(int64(65532)),
				RunAsGroup:   ptr.To(int64(65532)),
				FSGroup:      ptr.To(int64(65532)),
				SeccompProfile: &corev1.SeccompProfile{
					Type: corev1.SeccompProfileTypeRuntimeDefault,
				},
			},
			Containers: []corev1.Container{
				{
					Name: ReindexContainerName,
					SecurityContext: &corev1.SecurityContext{
						AllowPrivilegeEscalation: ptr.To(false),
						ReadOnlyRootFilesystem:   ptr.To(true),
						RunAsNonRoot:             ptr.To(true),
						Capabilities: &corev1.Capabilities{
							Drop: []corev1.Capability{"ALL"},
						},
					},
				},
			},
		},
	}
}

// JobBuildOptions contains the dynamic values injected by the controller.
type JobBuildOptions struct {
	// ReindexJobName is the name of the ReindexJob resource.
	ReindexJobName string
	// JobNamespace is the namespace where the Job will be created.
	JobNamespace string
	// ActivityImage is the container image for the reindex worker.
	ActivityImage string
	// ControllerArgs are the arguments built from NATS config (appended after template args).
	ControllerArgs []string
	// ResourceRequirements are the resource limits/requests for the container.
	ResourceRequirements corev1.ResourceRequirements
	// ServiceAccountName overrides the template's service account if set.
	ServiceAccountName string
}

// MergeJobTemplate creates a Job by merging the template with controller-managed fields.
// Controller-managed fields (always injected, cannot be overridden):
//   - Job name: {reindexJobName}-job
//   - Job namespace: from options
//   - Container image: from options
//   - Container args: template args first, then controller args appended
//   - Labels: app: activity-reindex, reindex.activity.miloapis.com/job: {name}
//   - BackoffLimit: 3
//   - TTLSecondsAfterFinished: 300
//
// Template-configurable fields are preserved from the template.
func MergeJobTemplate(template *corev1.PodTemplateSpec, opts JobBuildOptions) *batchv1.Job {
	// Deep copy the template to avoid mutating the original
	podSpec := template.Spec.DeepCopy()

	// Controller-managed labels (merged, not replaced)
	labels := map[string]string{
		"app":                               "activity-reindex",
		"reindex.activity.miloapis.com/job": opts.ReindexJobName,
	}

	// Merge labels from template
	if template.Labels != nil {
		for k, v := range template.Labels {
			if _, exists := labels[k]; !exists {
				labels[k] = v
			}
		}
	}

	// Set RestartPolicy if not specified
	if podSpec.RestartPolicy == "" {
		podSpec.RestartPolicy = corev1.RestartPolicyOnFailure
	}

	// Override service account if specified in options
	if opts.ServiceAccountName != "" {
		podSpec.ServiceAccountName = opts.ServiceAccountName
	}

	// Find or create the reindex container
	reindexContainer := findOrCreateReindexContainer(podSpec)

	// Set controller-managed container fields
	reindexContainer.Image = opts.ActivityImage

	// Merge args: template args first, then controller args appended
	reindexContainer.Args = append(reindexContainer.Args, opts.ControllerArgs...)

	// Set resource requirements if provided
	if len(opts.ResourceRequirements.Limits) > 0 || len(opts.ResourceRequirements.Requests) > 0 {
		// Merge with existing resources (controller values take precedence)
		if reindexContainer.Resources.Limits == nil {
			reindexContainer.Resources.Limits = make(corev1.ResourceList)
		}
		if reindexContainer.Resources.Requests == nil {
			reindexContainer.Resources.Requests = make(corev1.ResourceList)
		}
		for k, v := range opts.ResourceRequirements.Limits {
			reindexContainer.Resources.Limits[k] = v
		}
		for k, v := range opts.ResourceRequirements.Requests {
			reindexContainer.Resources.Requests[k] = v
		}
	}

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-job", opts.ReindexJobName),
			Namespace: opts.JobNamespace,
			Labels:    labels,
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            ptr.To(int32(3)),
			TTLSecondsAfterFinished: ptr.To(int32(300)),
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
				},
				Spec: *podSpec,
			},
		},
	}

	return job
}

// findOrCreateReindexContainer finds the container named "reindex" or creates one.
func findOrCreateReindexContainer(podSpec *corev1.PodSpec) *corev1.Container {
	for i := range podSpec.Containers {
		if podSpec.Containers[i].Name == ReindexContainerName {
			return &podSpec.Containers[i]
		}
	}

	// Container not found, create a new one with secure defaults
	podSpec.Containers = append(podSpec.Containers, corev1.Container{
		Name: ReindexContainerName,
		SecurityContext: &corev1.SecurityContext{
			AllowPrivilegeEscalation: ptr.To(false),
			ReadOnlyRootFilesystem:   ptr.To(true),
			RunAsNonRoot:             ptr.To(true),
			Capabilities: &corev1.Capabilities{
				Drop: []corev1.Capability{"ALL"},
			},
		},
	})

	return &podSpec.Containers[len(podSpec.Containers)-1]
}
