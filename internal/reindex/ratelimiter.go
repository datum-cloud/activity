package reindex

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/time/rate"
)

// RateLimiter controls the rate of event processing using a token bucket algorithm.
type RateLimiter struct {
	limiter *rate.Limiter
}

// NewRateLimiter creates a new rate limiter that allows up to eventsPerSecond events.
// The burst size is set to max(eventsPerSecond*2, batchSize) so that a single batch
// reservation never exceeds the burst capacity and causes ReserveN to fail.
func NewRateLimiter(eventsPerSecond, batchSize int) *RateLimiter {
	burst := eventsPerSecond * 2
	if batchSize > burst {
		burst = batchSize
	}
	if burst < 1 {
		burst = 1
	}

	return &RateLimiter{
		limiter: rate.NewLimiter(rate.Limit(eventsPerSecond), burst),
	}
}

// Wait blocks until n tokens are available or ctx is cancelled.
// Returns an error if the rate limit cannot be satisfied or if ctx is cancelled.
func (rl *RateLimiter) Wait(ctx context.Context, n int) error {
	if n <= 0 {
		return nil
	}

	// Reserve n tokens
	reservation := rl.limiter.ReserveN(time.Now(), n)
	if !reservation.OK() {
		return fmt.Errorf("rate limit exceeded: cannot reserve %d tokens", n)
	}

	// Wait for the required delay
	delay := reservation.Delay()
	if delay > 0 {
		select {
		case <-time.After(delay):
			return nil
		case <-ctx.Done():
			// Cancel the reservation if context is cancelled
			reservation.Cancel()
			return ctx.Err()
		}
	}

	return nil
}
