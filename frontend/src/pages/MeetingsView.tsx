import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Plus,
  Clock,
  CheckCircle,
  FileCheck,
  TrendingUp,
  UserCheck,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ProjectGroup, Meeting, EffortSummary } from '../types';

export const MeetingsView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [activeTab, setActiveTab] = useState<'meetings' | 'logbook'>('meetings');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [effortSummary, setEffortSummary] = useState<EffortSummary | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [minutesText, setMinutesText] = useState('');
  const [decisionsText, setDecisionsText] = useState('');
  const [meetingHours, setMeetingHours] = useState(1);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New Meeting Form
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    scheduled_at: '',
    duration_minutes: 60,
    mode: 'IN_PERSON',
    venue_link: 'Faculty Office B-204',
    agenda: ''
  });

  // Log Effort Form
  const [effortForm, setEffortForm] = useState({
    work_date: new Date().toISOString().split('T')[0],
    hours: 3,
    category: 'BUILD',
    description: ''
  });

  useEffect(() => {
    loadGroups();
  }, [user, activeRole]);

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupMeetingsAndEffort(selectedGroupId);
    }
  }, [selectedGroupId]);

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGroups();
      setGroups(data || []);
      if (data && data.length > 0) {
        setSelectedGroupId(data[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupMeetingsAndEffort = async (groupId: string) => {
    try {
      const [mtgs, effort] = await Promise.all([
        api.getGroupMeetings(groupId).catch(() => []),
        api.getEffortSummary(groupId).catch(() => null)
      ]);
      setMeetings(mtgs || []);
      setEffortSummary(effort);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) return;

    try {
      await api.scheduleMeeting(selectedGroupId, meetingForm);
      setMessage({ text: 'Supervisory meeting scheduled successfully', isError: false });
      setShowScheduleModal(false);
      loadGroupMeetingsAndEffort(selectedGroupId);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleLogEffort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !effortForm.description.trim()) return;

    try {
      await api.logEffort(selectedGroupId, effortForm);
      setMessage({ text: 'Work effort logged to 300-hour logbook', isError: false });
      setShowLogModal(false);
      setEffortForm({ ...effortForm, description: '', hours: 3 });
      loadGroupMeetingsAndEffort(selectedGroupId);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleSaveMinutes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting) return;

    try {
      await api.saveMinutes(selectedMeeting.id, {
        notes: minutesText,
        decisions: decisionsText,
        effort_hours_logged: meetingHours
      });
      setMessage({ text: 'Meeting minutes saved', isError: false });
      setSelectedMeeting(null);
      loadGroupMeetingsAndEffort(selectedGroupId);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleSignOffMinutes = async (meetingId: string) => {
    try {
      await api.signOffMinutes(meetingId);
      setMessage({ text: 'Meeting minutes officially signed off and locked', isError: false });
      setSelectedMeeting(null);
      loadGroupMeetingsAndEffort(selectedGroupId);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleVerifyEffort = async (entryId: string) => {
    try {
      await api.verifyEffort(entryId);
      setMessage({ text: 'Student effort verified by supervisor', isError: false });
      loadGroupMeetingsAndEffort(selectedGroupId);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const isSupervisor = activeRole === 'SUPERVISOR' || activeRole === 'CO_SUPERVISOR' || activeRole === 'FYP_COORDINATOR';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Supervision Meetings &amp; 300-Hour Logbook</h1>
          <p className="page-subtitle">
            Catalogued advisory sessions, official minutes sign-offs, and verified effort rollups
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowLogModal(true)}>
            <Plus size={16} /> Log Effort Hours
          </button>
          <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
            <CalendarCheck size={16} /> Schedule Advisory Meeting
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '6px', marginBottom: '16px',
          background: message.isError ? '#FEF2F2' : '#ECFDF5',
          color: message.isError ? '#991B1B' : '#065F46',
          border: `1px solid ${message.isError ? '#FECACA' : '#A7F3D0'}`,
          fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ACTIVE GROUP SELECTOR */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
            Active Group Context:
          </label>
          <select
            className="form-select"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            style={{ maxWidth: '400px' }}
          >
            {groups.map(g => (
              <option key={g.id} value={g.id}>
                {g.group_code} — {g.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 300-HOUR CUMULATIVE EFFORT DASHBOARD WIDGET */}
      {effortSummary && (
        <div className="card" style={{ borderLeft: '4px solid #0E2A47' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Project 300-Hour Framework Target</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0E2A47' }}>
                  {effortSummary.total_hours} / 300 Hours ({effortSummary.progress_percent}%)
                </span>
              </div>
              <div className="progress-track" style={{ height: '10px' }}>
                <div className="progress-fill" style={{ width: `${effortSummary.progress_percent}%`, background: '#0E2A47' }}></div>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                Verified by Faculty: <strong>{effortSummary.verified_hours} Hours</strong>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Weekly Pace Expectation:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-success">9 Hours / Week Target</span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  {effortSummary.total_hours >= 18 ? 'Pace verified' : 'Requires active tracking'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'meetings' ? 'active' : ''}`}
          onClick={() => setActiveTab('meetings')}
        >
          Supervisory Meetings ({meetings.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'logbook' ? 'active' : ''}`}
          onClick={() => setActiveTab('logbook')}
        >
          Effort Logbook &amp; Verification
        </button>
      </div>

      {/* TAB CONTENT: MEETINGS */}
      {activeTab === 'meetings' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Meeting Subject</th>
                  <th>Date &amp; Time</th>
                  <th>Mode / Venue</th>
                  <th>Duration</th>
                  <th>Minutes &amp; Sign-off</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {meetings.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                      No meetings scheduled for this group yet.
                    </td>
                  </tr>
                ) : (
                  meetings.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>{m.title}</td>
                      <td>{new Date(m.scheduled_at).toLocaleString()}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ marginRight: '6px' }}>{m.mode}</span>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>{m.venue_link}</span>
                      </td>
                      <td>{m.duration_minutes} mins</td>
                      <td>
                        {m.supervisor_signed_off ? (
                          <span className="badge badge-success">
                            <CheckCircle size={12} /> Signed Off by Supervisor
                          </span>
                        ) : (
                          <span className="badge badge-warning">Pending Sign-off</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedMeeting(m);
                            setMinutesText(m.minutes_notes || '');
                            setDecisionsText(m.minutes_decisions || '');
                            setMeetingHours(m.effort_hours_logged || 1);
                          }}
                        >
                          <FileCheck size={12} /> Minutes &amp; Actions
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EFFORT LOGBOOK */}
      {activeTab === 'logbook' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student Contributor</th>
                  <th>Category</th>
                  <th>Hours</th>
                  <th>Work Description</th>
                  <th>Supervisor Verification</th>
                  {isSupervisor && <th>Verify</th>}
                </tr>
              </thead>
              <tbody>
                {(!effortSummary?.entries || effortSummary.entries.length === 0) ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                      No work effort entries logged yet. Click "Log Effort Hours" to add student time.
                    </td>
                  </tr>
                ) : (
                  effortSummary.entries.map(e => (
                    <tr key={e.id}>
                      <td>{e.work_date}</td>
                      <td style={{ fontWeight: 600 }}>{e.student_name}</td>
                      <td>
                        <span className="badge badge-neutral">{e.category}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0E2A47' }}>{e.hours} hrs</td>
                      <td style={{ maxWidth: '320px' }}>{e.description}</td>
                      <td>
                        {e.verified_by ? (
                          <span className="badge badge-success">Verified</span>
                        ) : (
                          <span className="badge badge-neutral">Unverified</span>
                        )}
                      </td>
                      {isSupervisor && (
                        <td>
                          {!e.verified_by && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleVerifyEffort(e.id)}
                            >
                              Verify
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCHEDULE MEETING MODAL */}
      {showScheduleModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Schedule Advisory Supervisory Meeting</h3>
              <button onClick={() => setShowScheduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleScheduleMeeting}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Meeting Subject / Agenda Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Architecture Review &amp; SDD Verification"
                    value={meetingForm.title}
                    onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Scheduled Date &amp; Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={meetingForm.scheduled_at}
                      onChange={(e) => setMeetingForm({ ...meetingForm, scheduled_at: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Duration (Minutes)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={meetingForm.duration_minutes}
                      onChange={(e) => setMeetingForm({ ...meetingForm, duration_minutes: parseInt(e.target.value, 10) })}
                      min={15}
                      max={240}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Mode</label>
                    <select
                      className="form-select"
                      value={meetingForm.mode}
                      onChange={(e) => setMeetingForm({ ...meetingForm, mode: e.target.value })}
                    >
                      <option value="IN_PERSON">In Person</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Venue / Meeting URL</label>
                    <input
                      type="text"
                      className="form-input"
                      value={meetingForm.venue_link}
                      onChange={(e) => setMeetingForm({ ...meetingForm, venue_link: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Agenda &amp; Discussion Points</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Key items to be addressed during meeting..."
                    value={meetingForm.agenda}
                    onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG EFFORT MODAL */}
      {showLogModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Log Student Effort Hours (300h Target)</h3>
              <button onClick={() => setShowLogModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleLogEffort}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Work Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={effortForm.work_date}
                      onChange={(e) => setEffortForm({ ...effortForm, work_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Effort Hours Spent *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="14"
                      className="form-input"
                      value={effortForm.hours}
                      onChange={(e) => setEffortForm({ ...effortForm, hours: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Activity Category *</label>
                  <select
                    className="form-select"
                    value={effortForm.category}
                    onChange={(e) => setEffortForm({ ...effortForm, category: e.target.value })}
                  >
                    <option value="RESEARCH">Research &amp; Literature Review</option>
                    <option value="DESIGN">Architecture &amp; System Design</option>
                    <option value="BUILD">Coding &amp; Implementation</option>
                    <option value="TEST">Testing &amp; Quality Assurance</option>
                    <option value="DOCUMENT">Documentation &amp; Report Writing</option>
                    <option value="MEETING">Supervisory Advisory Meeting</option>
                    <option value="OTHER">Other Academic Work</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Work Description &amp; Concrete Outcomes *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Specify the modules implemented, tests conducted, or research papers analyzed..."
                    value={effortForm.description}
                    onChange={(e) => setEffortForm({ ...effortForm, description: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLogModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save to Logbook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEETING MINUTES & ACTIONS MODAL */}
      {selectedMeeting && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3 className="card-title">{selectedMeeting.title}</h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  {new Date(selectedMeeting.scheduled_at).toLocaleString()}
                </span>
              </div>
              <button onClick={() => setSelectedMeeting(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveMinutes}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Official Minutes / Discussion Record *</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Record detailed notes of progress discussed..."
                    value={minutesText}
                    onChange={(e) => setMinutesText(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Key Decisions Taken</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Agreed scope adjustments, methodology choices..."
                    value={decisionsText}
                    onChange={(e) => setDecisionsText(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Meeting Effort Hours Credited to Team</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    value={meetingHours}
                    onChange={(e) => setMeetingHours(parseFloat(e.target.value))}
                  />
                </div>

                {isSupervisor && !selectedMeeting.supervisor_signed_off && (
                  <div style={{ marginTop: '16px', background: '#FEFCE8', padding: '12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#854D0E', marginBottom: '6px' }}>
                      Supervisor Formal Sign-off:
                    </div>
                    <p style={{ fontSize: '12px', color: '#713F12', marginBottom: '10px' }}>
                      Signing off will lock these minutes and credit verified meeting effort to student records.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSignOffMinutes(selectedMeeting.id)}
                    >
                      Sign Off &amp; Lock Minutes
                    </button>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedMeeting(null)}>
                  Close
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Minutes Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
