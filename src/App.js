import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// Local storage key for team data
const LOCAL_STORAGE_KEY = 'fourBoxTeamData';
const appId = 'local-app-id';

// --- Helper Functions & Constants ---
const GRID_SIZE = 500; 
const AXIS_MARGIN = 50;
const PLOT_AREA_SIZE = GRID_SIZE - 2 * AXIS_MARGIN;
const MIN_VALUE = 50;
const MAX_VALUE = 150; 
const TREND_SCALE_FACTOR = 1.5; 

const MEMBER_COLORS = [
  '#4285F4', '#DB4437', '#F4B400', '#0F9D58',
  '#AB47BC', '#FF7043', '#7E57C2', '#66BB6A',
  '#26A69A', '#EC407A', '#5C6BC0', '#FFA726',
  '#8D6E63', '#BDBDBD', '#78909C', '#29B6F6'
];

const QUADRANT_DEFINITIONS = [
  { name: "", xRange: [50, 100], yRange: [100, 150], fill: 'rgba(15, 157, 88, 0.05)' }, 
  { name: "", xRange: [100, 150], yRange: [100, 150], fill: 'rgba(66, 133, 244, 0.05)' }, 
  { name: "", xRange: [50, 100], yRange: [50, 100], fill: 'rgba(219, 68, 55, 0.05)' }, 
  { name: "", xRange: [100, 150], yRange: [50, 100], fill: 'rgba(244, 180, 0, 0.05)' }, 
];

const mapToSvgCoords = (potential, performance) => {
  const x = AXIS_MARGIN + ((potential - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE; 
  const y = AXIS_MARGIN + ((MAX_VALUE - performance) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE; 
  return { x, y };
};

const mapSvgToScores = (svgX, svgY) => {
  let potential = MIN_VALUE + ((svgX - AXIS_MARGIN) / PLOT_AREA_SIZE) * (MAX_VALUE - MIN_VALUE);
  let performance = MIN_VALUE + ((MAX_VALUE - MIN_VALUE) - (((svgY - AXIS_MARGIN) / PLOT_AREA_SIZE) * (MAX_VALUE - MIN_VALUE)));
  potential = Math.max(MIN_VALUE, Math.min(MAX_VALUE, potential));
  performance = Math.max(MIN_VALUE, Math.min(MAX_VALUE, performance));
  return { potential, performance };
};

// --- CSV Helper Functions ---
const CSV_HEADERS = ['name', 'potential', 'performance', 'trendPotential', 'trendPerformance', 'manager'];

function escapeCsvValue(value) {
    if (value === null || typeof value === 'undefined') return '';
    const stringValue = String(value);
    // If value contains comma, newline or double quote, then enclose it in double quotes.
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        // Escape double quotes by doubling them
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function teamMembersToCsv(members) {
    const headerRow = CSV_HEADERS.join(',');
    const dataRows = members.map(member => {
        // Create a copy with rounded values
        const memberForExport = {...member};
        
        // Round potential and performance to 2 decimal places
        if (typeof memberForExport.potential === 'number') {
            memberForExport.potential = parseFloat(memberForExport.potential.toFixed(2));
        }
        
        if (typeof memberForExport.performance === 'number') {
            memberForExport.performance = parseFloat(memberForExport.performance.toFixed(2));
        }
        
        return CSV_HEADERS.map(header => escapeCsvValue(memberForExport[header])).join(',');
    });
    return [headerRow, ...dataRows].join('\n');
}

function csvToTeamMembers(csvString) {
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) return []; // Must have header and at least one data row

    const headers = lines[0].split(',').map(h => h.trim());
    
    // Basic validation for expected headers
    const missingHeaders = CSV_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0 && !CSV_HEADERS.every(h => headers.includes(h))) { // Allow extra columns but ensure all required are present
        console.error("CSV missing required headers:", missingHeaders);
        // In a real app, show this error to the user via a modal or toast
        const errorModal = document.createElement('div');
        errorModal.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:orange; color:white; padding:10px 20px; border-radius:5px; z-index:1002;';
        errorModal.textContent = `CSV Import Error: Missing headers - ${missingHeaders.join(', ')}. Ensure your CSV has: ${CSV_HEADERS.join(', ')}`;
        document.body.appendChild(errorModal);
        setTimeout(() => errorModal.remove(), 5000);
        return null; // Indicate error
    }


    const members = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(','); // Simple split, doesn't handle commas in quoted fields well.
                                          // For robust parsing, a library would be better.
        const memberData = {};
        headers.forEach((header, index) => {
            if (CSV_HEADERS.includes(header)) { // Only process expected headers
                 let value = values[index] ? values[index].trim() : '';
                 // Unescape CSV value if it was quoted
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1).replace(/""/g, '"');
                }

                if (['potential', 'performance'].includes(header)) {
                    // Round potential and performance to 2 decimal places
                    memberData[header] = parseFloat((parseFloat(value) || 0).toFixed(2));
                } else if (['trendPotential', 'trendPerformance'].includes(header)) {
                    memberData[header] = parseFloat(value) || 0;
                } else {
                    memberData[header] = value;
                }
            }
        });
        // Ensure all required fields are present, even if empty in CSV
        CSV_HEADERS.forEach(requiredHeader => {
            if (!(requiredHeader in memberData)) {
                if (['potential', 'performance'].includes(requiredHeader)) {
                    memberData[requiredHeader] = 0.00; // Ensure default is properly rounded
                } else if (['trendPotential', 'trendPerformance'].includes(requiredHeader)) {
                    memberData[requiredHeader] = 0;
                } else {
                    memberData[requiredHeader] = '';
                }
            }
        });

        // Always auto-assign id and color for imports
        memberData.id = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        memberData.color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
        
        members.push(memberData);
    }
    return members;
}


// --- React Components ---

const Tooltip = ({ member, position }) => {
  if (!member || !position) return null;
  const style = {
    left: `${position.x + 10}px`, 
    top: `${position.y + 10}px`
  };
  return (
    <div className="tooltip" style={style}>
      <strong style={{ color: member.color, display: 'block', marginBottom: '4px' }}>{member.name}</strong>
      <div>Pot: {member.potential.toFixed(2)}, Perf: {member.performance.toFixed(2)}</div>
      <div>Trend Pot: {member.trendPotential.toFixed(0)}, Trend Perf: {member.trendPerformance.toFixed(0)}</div>
      {member.manager && <div>Mgr: {member.manager}</div>}
    </div>
  );
};

const MemberVisualization = ({ member, isIsolated, onMouseEnter, onMouseLeave, onMemberMouseDown, isDraggingThisMember }) => {
  const { x, y } = mapToSvgCoords(member.potential, member.performance);
  const arrowEndX = x + member.trendPotential * TREND_SCALE_FACTOR;
  const arrowEndY = y - member.trendPerformance * TREND_SCALE_FACTOR; 
  const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
  const clampedArrowEndX = clamp(arrowEndX, AXIS_MARGIN / 2, GRID_SIZE - AXIS_MARGIN / 2);
  const clampedArrowEndY = clamp(arrowEndY, AXIS_MARGIN / 2, GRID_SIZE - AXIS_MARGIN / 2);
  const hasTrend = member.trendPerformance !== 0 || member.trendPotential !== 0;
  const handleMouseDown = (e) => { if (onMemberMouseDown) onMemberMouseDown(member.id, e); };

  return (
    <g 
      onMouseEnter={(e) => onMouseEnter(member, { x: e.clientX, y: e.clientY })}
      onMouseLeave={onMouseLeave} onMouseDown={handleMouseDown}
      style={{ cursor: isDraggingThisMember ? 'grabbing' : 'grab', transition: isDraggingThisMember ? 'none' : 'opacity 0.3s ease' }}
      opacity={isIsolated ? 1 : 0.3}
    >
      {hasTrend && (
        <line x1={x} y1={y} x2={clampedArrowEndX} y2={clampedArrowEndY}
          stroke={member.color} strokeWidth="2" markerEnd="url(#arrowhead)" opacity={0.8}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <circle cx={x} cy={y} r="8" fill={member.color} stroke="#fff" strokeWidth="1.5" />
      <text x={x + 10} y={y + 4} fontSize="10" fill="#333"
        opacity={isIsolated ? 0.7 : 0.2} style={{pointerEvents: 'none'}}
      >
        {member.name.substring(0,12)}{member.name.length > 12 ? '...' : ''}
      </text>
    </g>
  );
};

const GridDisplay = ({ teamMembers, selectedMemberIds, onMemberHover, onMemberLeave, svgRefForward, onMemberMouseDown, draggingMemberId }) => {
  const anyMemberSelected = selectedMemberIds.length > 0;
  return (
    <div className="relative w-full aspect-square max-w-2xl mx-auto shadow-lg rounded-lg border border-gray-200 bg-white select-none grid-display-container">
      <svg ref={svgRefForward} viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`} className="w-full h-full">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,3 L0,6 Z" fill="#555" />
          </marker>
        </defs>
        {QUADRANT_DEFINITIONS.map(q => {
          const qXStart = AXIS_MARGIN + ((q.xRange[0] - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE;
          const qYStart = AXIS_MARGIN + ((MAX_VALUE - q.yRange[1]) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE;
          const qWidth = ((q.xRange[1] - q.xRange[0]) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE;
          const qHeight = ((q.yRange[1] - q.yRange[0]) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE;
          const midX = qXStart + qWidth / 2; const midY = qYStart + qHeight / 2;
          return (
            <g key={q.name}>
              <rect x={qXStart} y={qYStart} width={qWidth} height={qHeight} fill={q.fill} stroke="#e0e0e0" strokeDasharray="2,2" />
              <line x1={midX} y1={qYStart} x2={midX} y2={qYStart + qHeight} stroke="#d1d5db" strokeWidth="0.75" strokeDasharray="3,3" />
              <line x1={qXStart} y1={midY} x2={qXStart + qWidth} y2={midY} stroke="#d1d5db" strokeWidth="0.75" strokeDasharray="3,3" />
              <text x={qXStart + qWidth / 2} y={qYStart + qHeight / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize="12" fill="#777" className="font-semibold" style={{pointerEvents: 'none'}}>{q.name}</text>
            </g>
          );
        })}
        <line x1={AXIS_MARGIN} y1={GRID_SIZE - AXIS_MARGIN} x2={GRID_SIZE - AXIS_MARGIN} y2={GRID_SIZE - AXIS_MARGIN} stroke="#999" strokeWidth="1.5" />
        <line x1={AXIS_MARGIN} y1={GRID_SIZE - AXIS_MARGIN} x2={AXIS_MARGIN} y2={AXIS_MARGIN} stroke="#999" strokeWidth="1.5" />
                <line x1={AXIS_MARGIN + ((100 - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE} y1={AXIS_MARGIN} x2={AXIS_MARGIN + ((100 - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE} y2={GRID_SIZE - AXIS_MARGIN} stroke="#aaa" strokeWidth="1.25" strokeDasharray="4,4" />
        <line x1={AXIS_MARGIN} y1={AXIS_MARGIN + ((MAX_VALUE - 100) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE} x2={GRID_SIZE - AXIS_MARGIN} y2={AXIS_MARGIN + ((MAX_VALUE - 100) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE} stroke="#aaa" strokeWidth="1.25" strokeDasharray="4,4" />
        <text x={GRID_SIZE / 2} y={GRID_SIZE - AXIS_MARGIN / 2.5} textAnchor="middle" fontSize="14" fill="#333" className="font-medium">Potential →</text>
        <text x={AXIS_MARGIN / 2.5} y={GRID_SIZE / 2} textAnchor="middle" transform={`rotate(-90, ${AXIS_MARGIN / 2.5}, ${GRID_SIZE / 2})`} fontSize="14" fill="#333" className="font-medium">Performance →</text>
        {[50, 75, 100, 125, 150].map(val => {
            const xTick = AXIS_MARGIN + ((val - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE;
            const yTick = AXIS_MARGIN + ((MAX_VALUE - val) / (MAX_VALUE - MIN_VALUE)) * PLOT_AREA_SIZE;
            return (
                <g key={`tick-${val}`}>
                    <line x1={xTick} y1={GRID_SIZE - AXIS_MARGIN} x2={xTick} y2={GRID_SIZE - AXIS_MARGIN + 5} stroke="#999" strokeWidth="1" />
                    <text x={xTick} y={GRID_SIZE - AXIS_MARGIN + 18} textAnchor="middle" fontSize="10" fill="#555">{val}</text>
                    <line x1={AXIS_MARGIN - 5} y1={yTick} x2={AXIS_MARGIN} y2={yTick} stroke="#999" strokeWidth="1" />
                    <text x={AXIS_MARGIN - 18} y={yTick + 3} textAnchor="end" fontSize="10" fill="#555">{val}</text>
                </g>
            );
        })}
        {teamMembers.map(member => (
          <MemberVisualization key={member.id} member={member}
            isIsolated={!anyMemberSelected || selectedMemberIds.includes(member.id)}
            onMouseEnter={onMemberHover} onMouseLeave={onMemberLeave}
            onMemberMouseDown={onMemberMouseDown} isDraggingThisMember={member.id === draggingMemberId}
          />
        ))}
      </svg>
    </div>
  );
};

const ControlsPanel = ({ 
    teamMembers, onAddMember, onRemoveMember, onToggleIsolate, selectedMemberIds, userId,
    allManagers, selectedManager, onManagerChange, onExportCsv, onImportCsv, onEditMember
}) => {
  const [name, setName] = useState('');
  const [performance, setPerformance] = useState(100);
  const [potential, setPotential] = useState(100);
  const [trendPerformance, setTrendPerformance] = useState(0);
  const [trendPotential, setTrendPotential] = useState(0);
  const [manager, setManager] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const importFileRef = useRef(null);

  useEffect(() => {
    if (editingMember) {
      setName(editingMember.name);
      setPerformance(editingMember.performance);
      setPotential(editingMember.potential);
      setTrendPerformance(editingMember.trendPerformance);
      setTrendPotential(editingMember.trendPotential);
      setManager(editingMember.manager || '');
    }
  }, [editingMember]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:red; color:white; padding:10px 20px; border-radius:5px; z-index:1001;';
      modal.textContent = "Please enter a team member's name.";
      document.body.appendChild(modal);
      setTimeout(() => modal.remove(), 3000);
      return;
    }

    if (editingMember) {
      const updatedMember = {
        ...editingMember,
        name, 
        // Round performance and potential to 2 decimal places
        performance: parseFloat(parseFloat(performance).toFixed(2)),
        potential: parseFloat(parseFloat(potential).toFixed(2)),
        trendPerformance: parseFloat(trendPerformance), 
        trendPotential: parseFloat(trendPotential),
        manager: manager.trim()
      };
      onEditMember(updatedMember);
      setEditingMember(null);
    } else {
      const newMember = {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name, 
        // Round performance and potential to 2 decimal places
        performance: parseFloat(parseFloat(performance).toFixed(2)),
        potential: parseFloat(parseFloat(potential).toFixed(2)),
        trendPerformance: parseFloat(trendPerformance), 
        trendPotential: parseFloat(trendPotential),
        manager: manager.trim(), 
        color: MEMBER_COLORS[teamMembers.length % MEMBER_COLORS.length]
      };
      onAddMember(newMember);
    }
    
    setName(''); 
    setPerformance(100); 
    setPotential(100);
    setTrendPerformance(0); 
    setTrendPotential(0); 
    setManager('');
  };

  const handleImportClick = () => {
    importFileRef.current.click();
  };
  
  const handleFileImport = (event) => {
    onImportCsv(event);
    if (importFileRef.current) { // Reset file input so same file can be re-uploaded
        importFileRef.current.value = "";
    }
  };

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const buttonClass = "w-full px-4 py-2 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150";


  return (
    <div className="p-6 bg-white rounded-lg shadow-lg border border-gray-200 controls-panel">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200">Manage Team Members</h2>
      
      <form onSubmit={handleSubmit} className="space-y-5 mb-8 pb-8 border-b border-gray-200">
        {editingMember && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Editing: <span className="font-medium">{editingMember.name}</span>
                </p>
              </div>
            </div>
          </div>
        )}
        <div>
          <label htmlFor="name" className={labelClass}>Name</label>
          <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
        </div>
        <div> 
          <label htmlFor="manager" className={labelClass}>Manager Name</label>
          <input type="text" id="manager" value={manager} onChange={e => setManager(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="potential" className={labelClass}>Potential (50-150)</label>
            <input type="number" id="potential" value={potential} onChange={e => setPotential(e.target.value)} min="50" max="150" step="0.01" className={inputClass} />
          </div>
          <div>
            <label htmlFor="performance" className={labelClass}>Performance (50-150)</label>
            <input type="number" id="performance" value={performance} onChange={e => setPerformance(e.target.value)} min="50" max="150" step="0.01" className={inputClass} />
          </div>
        </div>
         <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="trendPotential" className={labelClass}>Trend Pot. (-20 to +20)</label>
            <input type="number" id="trendPotential" value={trendPotential} onChange={e => setTrendPotential(e.target.value)} min="-20" max="20" step="0.01" className={inputClass} />
          </div>
          <div>
            <label htmlFor="trendPerformance" className={labelClass}>Trend Perf. (-20 to +20)</label>
            <input type="number" id="trendPerformance" value={trendPerformance} onChange={e => setTrendPerformance(e.target.value)} min="-20" max="20" step="0.01" className={inputClass} />
          </div>
        </div>
        <div className="flex space-x-3">
          <button type="submit" className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 flex-1`}>
            {editingMember ? 'Save Changes' : 'Add Member'}
          </button>
          {editingMember && (
            <button 
              type="button" 
              onClick={() => {
                setEditingMember(null);
                setName('');
                setPerformance(100);
                setPotential(100);
                setTrendPerformance(0);
                setTrendPotential(0);
                setManager('');
              }}
              className={`${buttonClass} bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500 flex-1`}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mb-8">
        <label htmlFor="managerFilter" className={labelClass}>Filter by Manager</label>
        <select id="managerFilter" value={selectedManager} onChange={onManagerChange} className={`${inputClass} mt-1`}>
          <option value="ALL_MANAGERS">All Managers</option>
          {allManagers.map(mgr => (<option key={mgr} value={mgr}>{mgr}</option>))}
        </select>
      </div>

      {/* CSV Export/Import Section */}
      <div className="space-y-4 my-8 py-8 border-y border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Management</h3>
        <button onClick={onExportCsv} className={`${buttonClass} bg-green-600 text-white hover:bg-green-700 focus:ring-green-500`}>Export to CSV</button>
        <input type="file" accept=".csv" onChange={handleFileImport} ref={importFileRef} className="hidden" />
        <button onClick={handleImportClick} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`}>Import from CSV (Replaces Data)</button>
      </div>


      <h3 className="text-lg font-semibold text-gray-800 mb-4">Team Members</h3>
      {teamMembers.length === 0 ? (
        <p className="text-sm text-gray-500">No team members added yet.</p>
      ) : (
        <ul className="space-y-3 max-h-72 overflow-y-auto pr-2 team-list">
          {teamMembers.map(member => (
            <li key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-150">
              <div className="flex items-center">
                <input type="checkbox" id={`isolate-${member.id}`} checked={selectedMemberIds.includes(member.id)}
                  onChange={() => onToggleIsolate(member.id)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
                />
                <span style={{ width: '12px', height: '12px', backgroundColor: member.color, borderRadius: '50%', marginRight: '8px', display: 'inline-block' }}></span>
                <span className="text-sm font-medium text-gray-800">{member.name}</span>
                {member.manager && <span className="text-xs text-gray-500 ml-2">({member.manager})</span>}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => setEditingMember(member)} className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline">Edit</button>
                <button onClick={() => onRemoveMember(member.id)} className="text-xs text-red-600 hover:text-red-800 font-medium hover:underline">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function App() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [hoveredMember, setHoveredMember] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [selectedManager, setSelectedManager] = useState("ALL_MANAGERS");
  const [userId] = useState('local-user-id');
  const [isAuthReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [draggingMemberId, setDraggingMemberId] = useState(null);
  const svgGridRef = useRef(null);

  // Load initial data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedData) {
      try {
        setTeamMembers(JSON.parse(savedData));
      } catch (e) {
        console.error("Error parsing saved data", e);
      }
    }
  }, []);

  const saveDataLocally = useCallback((updatedTeamMembers) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTeamMembers));
    } catch (e) {
      console.error("Error saving to localStorage", e);
    }
  }, []);

  const handleAddMember = (newMember) => {
    const updated = [...teamMembers, newMember];
    setTeamMembers(updated); saveDataLocally(updated);
  };
  const handleRemoveMember = (memberId) => {
    const updated = teamMembers.filter(m => m.id !== memberId);
    setTeamMembers(updated); setSelectedMemberIds(p => p.filter(id => id !== memberId));
    saveDataLocally(updated);
  };
  const handleToggleIsolate = (memberId) => setSelectedMemberIds(p => p.includes(memberId) ? p.filter(id => id !== memberId) : [...p, memberId]);
  const handleMemberHover = useCallback((m, pos) => { if (!draggingMemberId) { setHoveredMember(m); setTooltipPosition(pos); }}, [draggingMemberId]);
  const handleMemberLeave = useCallback(() => { setHoveredMember(null); setTooltipPosition(null); }, []);
  const handleManagerChange = (e) => setSelectedManager(e.target.value);
  const handleEditMember = useCallback((member) => {
    const updated = teamMembers.map(m => 
      m.id === member.id ? member : m
    );
    setTeamMembers(updated);
    saveDataLocally(updated);
  }, [teamMembers, saveDataLocally]);

  const handleMemberMouseDown = useCallback((id, e) => { e.preventDefault(); setDraggingMemberId(id); setHoveredMember(null); }, []);

  useEffect(() => {
    const move = (e) => {
      if (!draggingMemberId || !svgGridRef.current) return;
      const svg = svgGridRef.current; const CTM = svg.getScreenCTM(); if (!CTM) return;
      let pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      pt = pt.matrixTransform(CTM.inverse());
      const { potential, performance } = mapSvgToScores(pt.x, pt.y);
      // Round potential and performance to 2 decimal places
      const roundedPotential = parseFloat(potential.toFixed(2));
      const roundedPerformance = parseFloat(performance.toFixed(2));
      setTeamMembers(prev => prev.map(m => m.id === draggingMemberId ? { ...m, potential: roundedPotential, performance: roundedPerformance } : m));
    };
    const up = () => {
      if (draggingMemberId) {
        setTeamMembers(curr => { saveDataLocally(curr); return curr; });
        setDraggingMemberId(null);
      }
    };
    if (draggingMemberId) {
      document.body.style.cursor = 'grabbing';
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    } else document.body.style.cursor = 'default';
    return () => {
      document.body.style.cursor = 'default';
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
    };
  }, [draggingMemberId, saveDataLocally]);

  const handleExportCsv = () => {
    const csvData = teamMembersToCsv(teamMembers);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'team_assessment_data.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleImportCsv = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvString = e.target.result;
        const importedMembers = csvToTeamMembers(csvString);
        if (importedMembers) { // Check if parsing was successful
            setTeamMembers(importedMembers);
            saveDataLocally(importedMembers);
            // Show success message
            const successModal = document.createElement('div');
            successModal.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:green; color:white; padding:10px 20px; border-radius:5px; z-index:1002;';
            successModal.textContent = `Successfully imported ${importedMembers.length} members. Data replaced.`;
            document.body.appendChild(successModal);
            setTimeout(() => successModal.remove(), 3000);
        }
        // csvToTeamMembers handles showing an error message if parsing fails
      };
      reader.onerror = () => {
        console.error("Error reading CSV file.");
        const errorModal = document.createElement('div');
        errorModal.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:red; color:white; padding:10px 20px; border-radius:5px; z-index:1002;';
        errorModal.textContent = "Error reading CSV file.";
        document.body.appendChild(errorModal);
        setTimeout(() => errorModal.remove(), 3000);
      };
      reader.readAsText(file);
    }
  };

  const allManagers = useMemo(() => Array.from(new Set(teamMembers.map(m => m.manager).filter(Boolean))).sort(), [teamMembers]);
  const filteredTeamMembersForGrid = useMemo(() => selectedManager === "ALL_MANAGERS" ? teamMembers : teamMembers.filter(m => m.manager === selectedManager), [teamMembers, selectedManager]);
  const teamMembersForList = teamMembers;


  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans grid-container">
      <header className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-indigo-700">Four Box Assessment Tool</h1>
        <p className="text-md text-gray-600 mt-1">Visualize Team Potential & Performance</p>
      </header>
      <div className="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ControlsPanel
            teamMembers={teamMembersForList} onAddMember={handleAddMember} onRemoveMember={handleRemoveMember}
            onToggleIsolate={handleToggleIsolate} selectedMemberIds={selectedMemberIds} userId={userId}
            allManagers={allManagers} selectedManager={selectedManager} onManagerChange={handleManagerChange}
            onExportCsv={handleExportCsv} onImportCsv={handleImportCsv} onEditMember={handleEditMember}
          />
        </div>
        <div className="lg:col-span-2">
          <GridDisplay teamMembers={filteredTeamMembersForGrid} selectedMemberIds={selectedMemberIds}
            onMemberHover={handleMemberHover} onMemberLeave={handleMemberLeave}
            svgRefForward={svgGridRef} onMemberMouseDown={handleMemberMouseDown} draggingMemberId={draggingMemberId}
          />
        </div>
      </div>
      <Tooltip member={hoveredMember} position={tooltipPosition} />
       <footer className="text-center mt-12 py-4 border-t border-gray-300">
        <p className="text-sm text-gray-500">Four Box Tool &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
