# Mermaid Diagrams in ACP Protocol Research

This document lists all the mermaid diagrams included in the ACP protocol research document.

## Diagram Index

### 1. Protocol Architecture (Section 1.3)
**File:** `acp-protocol-research.md:28`  
**Type:** Flowchart  
**Description:** High-level architecture showing bidirectional communication between Client and Agent

### 2. Protocol Message Flow (Section 1.3)
**File:** `acp-protocol-research.md:38`  
**Type:** Sequence Diagram  
**Description:** Complete message flow from initialization through prompt processing with streaming

### 3. Session Lifecycle (Section 3)
**File:** `acp-protocol-research.md:151`  
**Type:** State Diagram  
**Description:** State transitions for ACP sessions from disconnected to active processing

### 4. Content Block Types (Section 2.2)
**File:** `acp-protocol-research.md:202`  
**Type:** Class Diagram  
**Description:** Content block class hierarchy showing text, image, audio, resource, and resource_link types

### 5. Session Update Types (Section 3.3)
**File:** `acp-protocol-research.md:637`  
**Type:** Flowchart  
**Description:** Hierarchy of session update types organized by category (Content, Tool, State)

### 6. Tool Call Flow (Section 3.4)
**File:** `acp-protocol-research.md:731`  
**Type:** Sequence Diagram  
**Description:** Complete tool call flow including permission request and execution

### 7. OpenCode ACP Architecture (Section 6)
**File:** `acp-protocol-research.md:1158`  
**Type:** Flowchart  
**Description:** OpenCode architecture showing integration with MCP servers, agents, and tools

### 8. Bridge Architecture Overview (Section 7.1)
**File:** `acp-protocol-research.md:1193`  
**Type:** Flowchart  
**Description:** Bridge architecture connecting Chat UI via WebSocket to ACP Agent via stdio

### 9. User Message Flow (Section 7.3)
**File:** `acp-protocol-research.md:1247`  
**Type:** Sequence Diagram  
**Description:** Message flow from Chat UI through Bridge to ACP Agent

### 10. Agent Streaming Response (Section 7.3)
**File:** `acp-protocol-research.md:1296`  
**Type:** Sequence Diagram  
**Description:** Streaming response flow with tool calls from Agent back to Chat UI

### 11. Permission Request Flow (Section 7.3)
**File:** `acp-protocol-research.md:1307`  
**Type:** Sequence Diagram  
**Description:** Bidirectional permission request and response flow

### 12. Bridge Component Class Diagram (Section 7.2)
**File:** `acp-protocol-research.md:1324`  
**Type:** Class Diagram  
**Description:** Class structure of Bridge components (ACPBridgeServer, ProcessManager, WebSocketServer, etc.)

---

## Total Diagrams: 12

### By Type:
- **Sequence Diagrams:** 5
- **Flowcharts:** 4
- **Class Diagrams:** 2
- **State Diagrams:** 1

### By Section:
- **Protocol Architecture (1):** 2 diagrams
- **Message Structure (2):** 1 diagram
- **Session Lifecycle (3):** 1 diagram
- **Event Types (4):** 2 diagrams
- **OpenCode Implementation (6):** 1 diagram
- **Bridge Architecture (7):** 5 diagrams
