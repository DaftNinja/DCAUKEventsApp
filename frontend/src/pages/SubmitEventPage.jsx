import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import './SubmitEventPage.css';

export default function SubmitEventPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    title: '',
    organiser: '',
    organizerEmail: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    eventUrl: '',
    description: '',
  });

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  }

  function validate() {
    const e = {};
    if (!form.title.trim())         e.title = 'Title is required';
    if (!form.organiser.trim())     e.organiser = 'Organiser name is required';
    if (!form.organizerEmail.trim()) e.organizerEmail = 'Organiser email is required';
    if (!form.startDate)            e.startDate = 'Start date is required';
    if (!form.startTime)            e.startTime = 'Start time is required';
    if (!form.endDate)              e.endDate = 'End date is required';
    if (!form.endTime)              e.endTime = 'End time is required';
    if (form.eventUrl && !/^https?:\/\/.+/.test(form.eventUrl)) {
      e.eventUrl = 'Must be a valid URL starting with http:// or https://';
    }
    if (form.startDate && form.endDate && form.startTime && form.endTime) {
      const start = new Date(`${form.startDate}T${form.startTime}`);
      const end   = new Date(`${form.endDate}T${form.endTime}`);
      if (end <= start) e.endDate = 'End must be after start';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const startDate = new Date(`${form.startDate}T${form.startTime}`).toISOString();
      const endDate   = new Date(`${form.endDate}T${form.endTime}`).toISOString();

      await api.post('/api/events', {
        title:          form.title.trim(),
        organiser:      form.organiser.trim(),
        organizerEmail: form.organizerEmail.trim(),
        startDate,
        endDate,
        location:       form.location.trim() || undefined,
        eventUrl:       form.eventUrl.trim()  || undefined,
        description:    form.description.trim() || undefined,
      });

      setSubmitted(true);
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to submit event. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="sep-page">
        <Navbar />
        <div className="sep-body">
          <div className="sep-success">
            <div className="sep-success-icon">✓</div>
            <h1>Event submitted!</h1>
            <p>Thank you for submitting your event. The DCAUK team will review it shortly. You'll be notified once it's approved and visible to the community.</p>
            <div className="sep-success-actions">
              <button className="sep-btn-primary" onClick={() => navigate('/events')}>Browse events</button>
              <button className="sep-btn-ghost" onClick={() => { setSubmitted(false); setForm({ title: '', organiser: '', organizerEmail: '', startDate: '', startTime: '', endDate: '', endTime: '', location: '', eventUrl: '', description: '' }); }}>Submit another</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sep-page">
      <Navbar />
      <div className="sep-body">
        <div className="sep-header">
          <h1>Submit an event</h1>
          <p>Know about an event the community should hear about? Submit it here and the DCAUK team will review and publish it.</p>
        </div>

        <form className="sep-form" onSubmit={handleSubmit} noValidate>

          {/* Event details */}
          <div className="sep-section">
            <h2 className="sep-section-title">Event details</h2>

            <div className="sep-field">
              <label>Event title <span className="sep-required">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Data Centre World Summit 2026"
                className={errors.title ? 'sep-input-error' : ''}
              />
              {errors.title && <span className="sep-error">{errors.title}</span>}
            </div>

            <div className="sep-row">
              <div className="sep-field">
                <label>Start date <span className="sep-required">*</span></label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                  className={errors.startDate ? 'sep-input-error' : ''}
                />
                {errors.startDate && <span className="sep-error">{errors.startDate}</span>}
              </div>
              <div className="sep-field">
                <label>Start time <span className="sep-required">*</span></label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => set('startTime', e.target.value)}
                  className={errors.startTime ? 'sep-input-error' : ''}
                />
                {errors.startTime && <span className="sep-error">{errors.startTime}</span>}
              </div>
            </div>

            <div className="sep-row">
              <div className="sep-field">
                <label>End date <span className="sep-required">*</span></label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => set('endDate', e.target.value)}
                  className={errors.endDate ? 'sep-input-error' : ''}
                />
                {errors.endDate && <span className="sep-error">{errors.endDate}</span>}
              </div>
              <div className="sep-field">
                <label>End time <span className="sep-required">*</span></label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={e => set('endTime', e.target.value)}
                  className={errors.endTime ? 'sep-input-error' : ''}
                />
                {errors.endTime && <span className="sep-error">{errors.endTime}</span>}
              </div>
            </div>

            <div className="sep-field">
              <label>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="e.g. ExCeL London, or Online"
              />
            </div>

            <div className="sep-field">
              <label>Event website URL</label>
              <input
                type="url"
                value={form.eventUrl}
                onChange={e => set('eventUrl', e.target.value)}
                placeholder="https://..."
                className={errors.eventUrl ? 'sep-input-error' : ''}
              />
              {errors.eventUrl && <span className="sep-error">{errors.eventUrl}</span>}
            </div>

            <div className="sep-field">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Brief description of the event — what it covers, who it's for..."
                rows={4}
              />
            </div>
          </div>

          {/* Organiser details */}
          <div className="sep-section">
            <h2 className="sep-section-title">Organiser</h2>
            <p className="sep-section-note">Who is organising this event? This can be you or the third-party organiser.</p>

            <div className="sep-row">
              <div className="sep-field">
                <label>Organiser name <span className="sep-required">*</span></label>
                <input
                  type="text"
                  value={form.organiser}
                  onChange={e => set('organiser', e.target.value)}
                  placeholder="e.g. Clarion Events"
                  className={errors.organiser ? 'sep-input-error' : ''}
                />
                {errors.organiser && <span className="sep-error">{errors.organiser}</span>}
              </div>
              <div className="sep-field">
                <label>Organiser email <span className="sep-required">*</span></label>
                <input
                  type="email"
                  value={form.organizerEmail}
                  onChange={e => set('organizerEmail', e.target.value)}
                  placeholder="contact@organiser.com"
                  className={errors.organizerEmail ? 'sep-input-error' : ''}
                />
                {errors.organizerEmail && <span className="sep-error">{errors.organizerEmail}</span>}
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="sep-submit-error">{errors.submit}</div>
          )}

          <div className="sep-form-actions">
            <button type="submit" className="sep-btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
            <button type="button" className="sep-btn-ghost" onClick={() => navigate('/events')}>
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
