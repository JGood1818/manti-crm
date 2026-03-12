import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { fetchGraphData, findPath } from '../lib/graphAPI';
import { Search, ZoomIn, ZoomOut, Maximize2, Filter, X, GitBranch } from 'lucide-react';

const RELATIONSHIP_COLORS = {
  co_meeting: '#2E7D32',
  email_thread: '#1976D2',
  email_cc: '#7B1FA2',
  intro_chain: '#E65100',
  mentioned_together: '#455A64',
};

const RELATIONSHIP_LABELS = {
  co_meeting: 'Meeting',
  email_thread: 'Email',
  email_cc: 'CC',
  intro_chain: 'Intro',
  mentioned_together: 'Mentioned',
};

const CATEGORY_NODE_COLORS = {
  'Investor': '#1565C0',
  'Sales/BD': '#2E7D32',
  'Advisor': '#6A1B9A',
  'Partner': '#00838F',
  'Internal': '#E65100',
  'Academic': '#4527A0',
  'Legal': '#37474F',
  'Other': '#757575',
};

export default function RelationshipGraph({ onSelectContact }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [minStrength, setMinStrength] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [pathMode, setPathMode] = useState(false);
  const [pathStart, setPathStart] = useState(null);
  const [pathEnd, setPathEnd] = useState(null);
  const [highlightedPath, setHighlightedPath] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Load graph data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchGraphData();
        setGraphData(data);
      } catch (err) {
        console.error('Graph load error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Track container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Filter data
  const getFilteredData = useCallback(() => {
    if (!graphData) return { nodes: [], edges: [] };
    let { nodes, edges } = graphData;

    // Filter edges by type
    if (filterType !== 'all') {
      edges = edges.filter(e => e.type === filterType);
    }

    // Filter edges by strength
    if (minStrength > 0) {
      edges = edges.filter(e => e.strength >= minStrength);
    }

    // Get IDs of nodes that still have connections
    const connectedIds = new Set();
    edges.forEach(e => {
      connectedIds.add(typeof e.source === 'object' ? e.source.id : e.source);
      connectedIds.add(typeof e.target === 'object' ? e.target.id : e.target);
    });
    nodes = nodes.filter(n => connectedIds.has(n.id));

    // Search filter
    if (search) {
      const term = search.toLowerCase();
      const matchIds = new Set(
        nodes.filter(n =>
          n.name.toLowerCase().includes(term) ||
          (n.company || '').toLowerCase().includes(term)
        ).map(n => n.id)
      );
      // Keep matching nodes and their direct neighbors
      const neighborIds = new Set();
      edges.forEach(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        if (matchIds.has(s)) neighborIds.add(t);
        if (matchIds.has(t)) neighborIds.add(s);
      });
      const keepIds = new Set([...matchIds, ...neighborIds]);
      nodes = nodes.filter(n => keepIds.has(n.id));
      edges = edges.filter(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return keepIds.has(s) && keepIds.has(t);
      });
    }

    return { nodes, edges };
  }, [graphData, filterType, minStrength, search]);

  // D3 visualization
  useEffect(() => {
    if (!graphData || !dimensions.width || !dimensions.height) return;

    const { nodes: rawNodes, edges: rawEdges } = getFilteredData();
    if (rawNodes.length === 0) return;

    // Deep clone for D3 mutation
    const nodes = rawNodes.map(n => ({ ...n }));
    const edges = rawEdges.map(e => ({
      ...e,
      source: typeof e.source === 'object' ? e.source.id : e.source,
      target: typeof e.target === 'object' ? e.target.id : e.target,
    }));

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Main group for zoom/pan
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Arrow markers for directed edges
    const defs = svg.append('defs');
    Object.entries(RELATIONSHIP_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', color)
        .attr('d', 'M0,-5L10,0L0,5');
    });

    // Node radius scale
    const maxConn = d3.max(nodes, d => d.connectionCount) || 1;
    const radiusScale = d3.scaleSqrt().domain([0, maxConn]).range([8, 28]);

    // Edge width scale
    const maxStr = d3.max(edges, d => d.strength) || 1;
    const widthScale = d3.scaleLinear().domain([0.5, maxStr]).range([1, 5]).clamp(true);

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(d => {
        return 120 - Math.min(d.strength * 8, 60);
      }).strength(d => Math.min(d.strength * 0.15, 0.8)))
      .force('charge', d3.forceManyBody().strength(-300).distanceMax(400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => radiusScale(d.connectionCount) + 8))
      .force('x', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(height / 2).strength(0.03));

    simulationRef.current = simulation;

    // Draw edges
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', d => RELATIONSHIP_COLORS[d.type] || '#999')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => widthScale(d.strength))
      .attr('marker-end', d => d.type === 'intro_chain' ? `url(#arrow-${d.type})` : null);

    // Edge labels (only for strong connections)
    const linkLabel = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(edges.filter(e => e.strength >= 3))
      .join('text')
      .attr('font-size', 9)
      .attr('fill', d => RELATIONSHIP_COLORS[d.type] || '#666')
      .attr('text-anchor', 'middle')
      .attr('dy', -4)
      .text(d => `${RELATIONSHIP_LABELS[d.type]} (${d.strength})`);

    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circles
    node.append('circle')
      .attr('r', d => radiusScale(d.connectionCount))
      .attr('fill', d => CATEGORY_NODE_COLORS[d.category] || CATEGORY_NODE_COLORS.Other)
      .attr('stroke', d => d.isHighProfile ? '#FFD600' : '#fff')
      .attr('stroke-width', d => d.isHighProfile ? 3 : 2)
      .attr('opacity', 0.9);

    // High-profile star indicator
    node.filter(d => d.isHighProfile)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -radiusScale.range()[1] - 4)
      .attr('font-size', 12)
      .text('★')
      .attr('fill', '#FFD600');

    // Node labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => radiusScale(d.connectionCount) + 14)
      .attr('font-size', d => d.connectionCount >= 3 ? 12 : 10)
      .attr('font-weight', d => d.connectionCount >= 3 ? 600 : 400)
      .attr('fill', 'var(--text-primary)')
      .text(d => d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name);

    // Company sublabel for high-profile
    node.filter(d => d.isHighProfile && d.company)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => radiusScale(d.connectionCount) + 26)
      .attr('font-size', 9)
      .attr('fill', 'var(--text-secondary)')
      .text(d => d.company.length > 20 ? d.company.slice(0, 18) + '…' : d.company);

    // Hover interactions
    node.on('mouseenter', (event, d) => {
      setHoveredNode(d);
      // Highlight connected edges
      link.attr('stroke-opacity', e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return (s === d.id || t === d.id) ? 0.9 : 0.1;
      }).attr('stroke-width', e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return (s === d.id || t === d.id) ? widthScale(e.strength) + 2 : widthScale(e.strength);
      });
      // Dim unconnected nodes
      const neighborIds = new Set();
      edges.forEach(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        if (s === d.id) neighborIds.add(t);
        if (t === d.id) neighborIds.add(s);
      });
      node.select('circle').attr('opacity', n =>
        n.id === d.id || neighborIds.has(n.id) ? 1 : 0.2
      );
      node.selectAll('text').attr('opacity', n =>
        n.id === d.id || neighborIds.has(n.id) ? 1 : 0.2
      );
    }).on('mouseleave', () => {
      setHoveredNode(null);
      link.attr('stroke-opacity', 0.4)
        .attr('stroke-width', e => widthScale(e.strength));
      node.select('circle').attr('opacity', 0.9);
      node.selectAll('text').attr('opacity', 1);
    }).on('click', (event, d) => {
      event.stopPropagation();
      if (pathMode) {
        if (!pathStart) {
          setPathStart(d);
        } else if (!pathEnd) {
          setPathEnd(d);
          // Find and highlight path
          const path = findPath(edges, pathStart.id, d.id);
          setHighlightedPath(path);
        } else {
          // Reset path
          setPathStart(d);
          setPathEnd(null);
          setHighlightedPath(null);
        }
      } else {
        setSelectedNode(d);
      }
    });

    // Click on background to deselect
    svg.on('click', () => {
      setSelectedNode(null);
      if (!pathMode) {
        setPathStart(null);
        setPathEnd(null);
        setHighlightedPath(null);
      }
    });

    // Tick update
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Initial zoom to fit
    simulation.on('end', () => {
      const bounds = g.node().getBBox();
      if (bounds.width === 0) return;
      const scale = Math.min(
        width / (bounds.width + 80),
        height / (bounds.height + 80),
        1.5
      );
      const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
      const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      );
    });

    return () => simulation.stop();
  }, [graphData, dimensions, getFilteredData]);

  // Highlight path when found
  useEffect(() => {
    if (!highlightedPath || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const pathSet = new Set(highlightedPath);

    svg.selectAll('.links line')
      .attr('stroke-opacity', d => {
        const s = typeof d.source === 'object' ? d.source.id : d.source;
        const t = typeof d.target === 'object' ? d.target.id : d.target;
        return pathSet.has(s) && pathSet.has(t) ? 1 : 0.05;
      })
      .attr('stroke-width', d => {
        const s = typeof d.source === 'object' ? d.source.id : d.source;
        const t = typeof d.target === 'object' ? d.target.id : d.target;
        return pathSet.has(s) && pathSet.has(t) ? 4 : 1;
      });

    svg.selectAll('.nodes g circle')
      .attr('opacity', d => pathSet.has(d.id) ? 1 : 0.15);
    svg.selectAll('.nodes g text')
      .attr('opacity', d => pathSet.has(d.id) ? 1 : 0.15);
  }, [highlightedPath]);

  const handleZoom = (factor) => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      d3.zoom().scaleExtent([0.2, 4]).on('zoom', (event) => {
        svg.select('g').attr('transform', event.transform);
      }).scaleBy,
      factor
    );
  };

  const handleFitView = () => {
    const svg = d3.select(svgRef.current);
    const g = svg.select('g');
    const bounds = g.node()?.getBBox();
    if (!bounds || bounds.width === 0) return;
    const { width, height } = dimensions;
    const scale = Math.min(width / (bounds.width + 80), height / (bounds.height + 80), 1.5);
    const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
    const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
    svg.transition().duration(500).call(
      d3.zoom().scaleExtent([0.2, 4]).on('zoom', (event) => {
        g.attr('transform', event.transform);
      }).transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  };

  // Get edge details for selected node
  const getNodeEdges = (nodeId) => {
    if (!graphData) return [];
    return graphData.edges.filter(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      return s === nodeId || t === nodeId;
    });
  };

  const getNodeById = (id) => graphData?.nodes.find(n => n.id === id);

  if (loading) return <div className="graph-loading">Loading relationship graph...</div>;
  if (error) return <div className="graph-error">Error: {error}</div>;

  const filtered = getFilteredData();

  return (
    <div className="graph-wrapper">
      {/* Controls bar */}
      <div className="graph-controls">
        <div className="graph-controls-left">
          <div className="graph-search">
            <Search size={14} />
            <input
              placeholder="Search people or companies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch('')}><X size={12} /></button>}
          </div>
          <button
            className={`graph-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} /> Filters
          </button>
          <button
            className={`graph-btn ${pathMode ? 'active' : ''}`}
            onClick={() => {
              setPathMode(!pathMode);
              setPathStart(null);
              setPathEnd(null);
              setHighlightedPath(null);
            }}
            title="Find connection path between two people"
          >
            <GitBranch size={14} /> Path Finder
          </button>
        </div>
        <div className="graph-controls-right">
          <span className="graph-stat">{filtered.nodes.length} people</span>
          <span className="graph-stat">{filtered.edges.length} connections</span>
          <button className="graph-zoom-btn" onClick={() => handleZoom(1.3)}><ZoomIn size={16} /></button>
          <button className="graph-zoom-btn" onClick={() => handleZoom(0.7)}><ZoomOut size={16} /></button>
          <button className="graph-zoom-btn" onClick={handleFitView}><Maximize2 size={16} /></button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="graph-filters">
          <div className="graph-filter-group">
            <label>Relationship Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(RELATIONSHIP_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="graph-filter-group">
            <label>Min Strength: {minStrength}</label>
            <input type="range" min="0" max="7" step="0.5" value={minStrength}
              onChange={e => setMinStrength(parseFloat(e.target.value))} />
          </div>
          <div className="graph-legend">
            {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
              <div key={type} className="legend-item">
                <span className="legend-line" style={{ background: color }} />
                <span>{RELATIONSHIP_LABELS[type]}</span>
              </div>
            ))}
            <div className="legend-divider" />
            {Object.entries(CATEGORY_NODE_COLORS).filter(([k]) => k !== 'Other').map(([cat, color]) => (
              <div key={cat} className="legend-item">
                <span className="legend-dot" style={{ background: color }} />
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Path finder status */}
      {pathMode && (
        <div className="graph-path-status">
          <GitBranch size={14} />
          {!pathStart ? (
            <span>Click a person to set the <strong>starting point</strong></span>
          ) : !pathEnd ? (
            <span>
              From <strong>{pathStart.name}</strong> — click another person to find the connection path
            </span>
          ) : highlightedPath ? (
            <span>
              Path: {highlightedPath.map(id => getNodeById(id)?.name || '?').join(' → ')}
              ({highlightedPath.length - 1} hops)
            </span>
          ) : (
            <span>No connection path found between {pathStart.name} and {pathEnd.name}</span>
          )}
          <button onClick={() => { setPathStart(null); setPathEnd(null); setHighlightedPath(null); }}>
            Reset
          </button>
        </div>
      )}

      {/* SVG Canvas */}
      <div ref={containerRef} className="graph-canvas">
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
      </div>

      {/* Hover tooltip */}
      {hoveredNode && !selectedNode && (
        <div className="graph-tooltip">
          <div className="tooltip-name">{hoveredNode.name}</div>
          {hoveredNode.company && <div className="tooltip-company">{hoveredNode.company}</div>}
          {hoveredNode.role && <div className="tooltip-role">{hoveredNode.role}</div>}
          <div className="tooltip-connections">{hoveredNode.connectionCount} connections</div>
        </div>
      )}

      {/* Selected node detail sidebar */}
      {selectedNode && (
        <div className="graph-sidebar">
          <div className="graph-sidebar-header">
            <div>
              <h3>{selectedNode.name}</h3>
              {selectedNode.company && <p className="sidebar-company">{selectedNode.company}</p>}
              {selectedNode.role && <p className="sidebar-role">{selectedNode.role}</p>}
            </div>
            <button onClick={() => setSelectedNode(null)}><X size={18} /></button>
          </div>
          <div className="graph-sidebar-body">
            <div className="sidebar-section">
              <div className="sidebar-section-title">Category</div>
              <span className="sidebar-badge" style={{
                background: CATEGORY_NODE_COLORS[selectedNode.category] || '#757575',
                color: '#fff'
              }}>
                {selectedNode.category}
              </span>
              {selectedNode.isHighProfile && (
                <span className="sidebar-badge" style={{ background: '#FFD600', color: '#333', marginLeft: 8 }}>
                  ★ High Profile
                </span>
              )}
            </div>

            {(selectedNode.email || selectedNode.linkedin || selectedNode.website) && (
              <div className="sidebar-section">
                <div className="sidebar-section-title">Contact</div>
                {selectedNode.email && <div className="sidebar-detail">{selectedNode.email}</div>}
                {selectedNode.linkedin && (
                  <a href={selectedNode.linkedin.startsWith('http') ? selectedNode.linkedin : `https://${selectedNode.linkedin}`}
                    target="_blank" rel="noopener noreferrer" className="sidebar-link">LinkedIn</a>
                )}
                {selectedNode.website && (
                  <a href={selectedNode.website.startsWith('http') ? selectedNode.website : `https://${selectedNode.website}`}
                    target="_blank" rel="noopener noreferrer" className="sidebar-link">Website</a>
                )}
              </div>
            )}

            <div className="sidebar-section">
              <div className="sidebar-section-title">
                Connections ({getNodeEdges(selectedNode.id).length})
              </div>
              <div className="sidebar-connections">
                {getNodeEdges(selectedNode.id).map((edge, i) => {
                  const s = typeof edge.source === 'object' ? edge.source.id : edge.source;
                  const t = typeof edge.target === 'object' ? edge.target.id : edge.target;
                  const otherId = s === selectedNode.id ? t : s;
                  const other = getNodeById(otherId);
                  if (!other) return null;
                  return (
                    <div key={i} className="sidebar-connection"
                      onClick={() => setSelectedNode(other)}>
                      <div className="connection-name">{other.name}</div>
                      <div className="connection-meta">
                        <span className="connection-type" style={{
                          color: RELATIONSHIP_COLORS[edge.type]
                        }}>
                          {RELATIONSHIP_LABELS[edge.type]}
                        </span>
                        <span className="connection-strength">
                          {'●'.repeat(Math.min(Math.round(edge.strength), 7))}
                        </span>
                      </div>
                      {edge.evidence && edge.evidence.length > 0 && (
                        <div className="connection-evidence">
                          {edge.evidence.slice(0, 3).map((ev, j) => (
                            <div key={j} className="evidence-item">
                              {ev.description || ev.type}
                              {ev.date && <span className="evidence-date"> · {ev.date}</span>}
                            </div>
                          ))}
                          {edge.evidence.length > 3 && (
                            <div className="evidence-more">+{edge.evidence.length - 3} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button className="sidebar-view-btn" onClick={() => {
              onSelectContact?.(selectedNode);
              setSelectedNode(null);
            }}>
              View Full Contact →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
