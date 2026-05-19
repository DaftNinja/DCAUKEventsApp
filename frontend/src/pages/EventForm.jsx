export default function EventForm({ formData, editingEventId, onInputChange, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} style={{
      background: "white",
      color: "#333",
      padding: "30px",
      borderRadius: "12px",
      marginTop: "20px",
      marginBottom: "30px"
    }}>
      <h3 style={{marginTop: 0}}>{editingEventId ? "Edit Event" : "Create New Event"}</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Title *</label>
          <input type="text" name="title" value={formData.title} onChange={onInputChange} required placeholder="Event title" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
        </div>
        <div>
          <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Location *</label>
          <input type="text" name="location" value={formData.location} onChange={onInputChange} required placeholder="e.g., London, UK" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Start Date *</label>
          <input type="date" name="startDate" value={formData.startDate} onChange={onInputChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
        </div>
        <div>
          <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Start Time *</label>
          <input type="time" name="startTime" value={formData.startTime} onChange={onInputChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>End Date *</label>
          <input type="date" name="endDate" value={formData.endDate} onChange={onInputChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
        </div>
        <div>
          <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>End Time *</label>
          <input type="time" name="endTime" value={formData.endTime} onChange={onInputChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Organiser Name *</label>
          <input type="text" name="organiser" value={formData.organiser} onChange={onInputChange} required placeholder="e.g., DCA EMEA" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
        </div>
        <div>
          <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Organiser Email *</label>
          <input type="email" name="organizerEmail" value={formData.organizerEmail} onChange={onInputChange} required placeholder="organizer@example.com" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
        </div>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Sponsors</label>
        <input type="text" name="sponsors" value={formData.sponsors} onChange={onInputChange} placeholder="e.g., Company A, Company B" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Description</label>
        <textarea name="description" value={formData.description} onChange={onInputChange} placeholder="Event description (optional)" rows="4" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box", fontFamily: "inherit"}} />
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button type="submit" style={{padding: "12px 24px", background: "#667eea", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
          {editingEventId ? "Update Event" : "Create Event"}
        </button>
        <button type="button" onClick={onCancel} style={{padding: "12px 24px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
          Cancel
        </button>
      </div>
    </form>
  );
}
