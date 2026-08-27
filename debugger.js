// PyNova AI - Debug Lab & Visual Step Execution Controller

class DebuggerController {
  constructor() {
    this.initElements();
    this.bindEvents();
    this.currentSteps = [];
    this.activeStepIndex = 0;
  }

  initElements() {
    this.editor = document.getElementById("debugger-code-editor");
    this.lineNumbers = document.getElementById("debugger-line-numbers");
    this.console = document.getElementById("debugger-console");
    this.analyzeBtn = document.getElementById("debugger-analyze-btn");
    this.reportContainer = document.getElementById("debugger-report-container");
    this.visualizer = document.getElementById("debugger-visualizer");
    this.stepsRow = document.getElementById("debugger-steps-row");
    this.vizArea = document.getElementById("debugger-viz-area");
  }

  bindEvents() {
    if (this.editor) {
      this.editor.addEventListener("input", () => this.syncLineNumbers());
      this.editor.addEventListener("scroll", () => {
        if (this.lineNumbers) this.lineNumbers.scrollTop = this.editor.scrollTop;
      });
      this.editor.addEventListener("keydown", (e) => this.handleEditorKeys(e));
    }
    
    if (this.analyzeBtn) {
      this.analyzeBtn.addEventListener("click", () => this.analyzeBuggyCode());
    }
  }

  syncLineNumbers() {
    if (!this.editor || !this.lineNumbers) return;
    const lines = this.editor.value.split("\n");
    let numbers = "";
    for (let i = 1; i <= lines.length; i++) {
      numbers += i + "<br>";
    }
    this.lineNumbers.innerHTML = numbers;
  }

  handleEditorKeys(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = this.editor.selectionStart;
      const end = this.editor.selectionEnd;
      this.editor.value = this.editor.value.substring(0, start) + "    " + this.editor.value.substring(end);
      this.editor.selectionStart = this.editor.selectionEnd = start + 4;
      this.syncLineNumbers();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const start = this.editor.selectionStart;
      const text = this.editor.value;
      const beforeCursor = text.substring(0, start);
      const lines = beforeCursor.split("\n");
      const currentLine = lines[lines.length - 1];
      let indentMatch = currentLine.match(/^(\s*)/);
      let indent = indentMatch ? indentMatch[1] : "";
      if (currentLine.trim().endsWith(":")) {
        indent += "    ";
      }
      this.editor.value = text.substring(0, start) + "\n" + indent + text.substring(this.editor.selectionEnd);
      this.editor.selectionStart = this.editor.selectionEnd = start + 1 + indent.length;
      this.syncLineNumbers();
      this.editor.scrollTop = this.editor.scrollHeight;
    }
  }

  analyzeBuggyCode() {
    const code = this.editor.value;
    if (code.trim() === "") {
      this.console.innerText = "> Error: Please paste some python code first.";
      this.console.classList.add("error");
      return;
    }

    this.console.innerText = "> Running diagnostic scan...";
    this.console.classList.remove("error");
    
    // Log user activity
    window.PyNovaState.incrementDebugCount();
    window.PyNovaState.addActivity("Debugger Run", "Analyzed buggy code inside Debug Lab.");

    setTimeout(() => {
      // 1. Scan for standard errors using naive syntax analyzer
      const issues = this.scanForSyntaxIssues(code);
      this.renderReport(issues);
      
      // 2. Build execution steps
      this.currentSteps = this.generateExecutionSteps(code, issues.hasError);
      this.activeStepIndex = 0;
      
      if (this.currentSteps.length > 0) {
        this.visualizer.style.display = "flex";
        this.renderStepsSelector();
        this.renderActiveStep();
      } else {
        this.visualizer.style.display = "none";
      }

      this.console.innerText = issues.hasError ? "> Scan finished. Issues detected." : "> Scan complete. Code looks correct.";
    }, 600);
  }

  scanForSyntaxIssues(code) {
    const lines = code.split("\n");
    let issues = {
      hasError: false,
      title: "Syntax & Logic Analysis",
      why: "No syntax errors found! The code structure looks correct.",
      how: "Check if the code produces the output you expected. If you need improvements, consider modularizing your logic with functions.",
      corrected: code,
      errorLines: []
    };

    // Rule 0: Check for unclosed brackets/parentheses (skip string literals)
    let parenCount = 0, bracketCount = 0, braceCount = 0;
    let inSingleQuote = false, inDoubleQuote = false;
    let escapeNext = false;
    
    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      
      // Handle escape sequences
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      
      // Track if we're inside a string
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      }
      
      // Only count brackets outside of strings
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === "(") parenCount++;
        if (char === ")") parenCount--;
        if (char === "[") bracketCount++;
        if (char === "]") bracketCount--;
        if (char === "{") braceCount++;
        if (char === "}") braceCount--;
        
        if (parenCount < 0 || bracketCount < 0 || braceCount < 0) {
          issues.hasError = true;
          issues.title = "Unmatched Closing Bracket (SyntaxError)";
          issues.why = `The code contains a closing bracket without a matching opening bracket.`;
          issues.how = "Check that all opening brackets '(', '[', '{' have corresponding closing brackets.";
          issues.errorLines.push(code.substring(0, i).split("\n").length);
          return issues;
        }
      }
    }
    
    if (parenCount !== 0) {
      issues.hasError = true;
      issues.title = "Unclosed Parenthesis (SyntaxError)";
      issues.why = `Missing ${parenCount} closing parenthesis/parentheses ')'. All function calls and expressions must have matching brackets.`;
      issues.how = "Check that every opening '(' has a corresponding closing ')'.";
      // Auto-correct: append missing closing parentheses
      if (parenCount > 0) {
        issues.corrected = code + ")".repeat(parenCount);
      }
      return issues;
    }
    if (bracketCount !== 0) {
      issues.hasError = true;
      issues.title = "Unclosed Bracket (SyntaxError)";
      issues.why = `Missing ${bracketCount} closing bracket/brackets ']'. All list/array accesses must have matching brackets.`;
      issues.how = "Check that every opening '[' has a corresponding closing ']'.";
      // Auto-correct: append missing closing brackets
      if (bracketCount > 0) {
        issues.corrected = code + "]".repeat(bracketCount);
      }
      return issues;
    }
    if (braceCount !== 0) {
      issues.hasError = true;
      issues.title = "Unclosed Brace (SyntaxError)";
      issues.why = `Missing ${braceCount} closing brace/braces '}'. All dictionaries/sets must have matching braces.`;
      issues.how = "Check that every opening '{' has a corresponding closing '}'.";
      // Auto-correct: append missing closing braces
      if (braceCount > 0) {
        issues.corrected = code + "}".repeat(braceCount);
      }
      return issues;
    }

    // Rule 1: check for missing colon after if/else/for/while/def
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if ((line.startsWith("if ") || line.startsWith("elif ") || line.startsWith("else") || 
           line.startsWith("for ") || line.startsWith("while ") || line.startsWith("def ")) && !line.endsWith(":")) {
        issues.hasError = true;
        issues.title = "Missing Colon (SyntaxError)";
        issues.why = `Line ${i + 1} contains a block declaration statement: "${line}" but is missing a colon ':' at the end.`;
        issues.how = "Python headers (if, for, while, def) require a colon at the end of the line to identify blocks.";
        
        // Build corrected code
        let newLines = [...lines];
        newLines[i] = lines[i] + ":";
        issues.corrected = newLines.join("\n");
        issues.errorLines.push(i + 1);
        return issues; // Return first error
      }
    }

    // Rule 2: check for assignment vs equality check in 'if'
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("if ") && line.includes("=") && !line.includes("==") && !line.includes("!=") && !line.includes(">=") && !line.includes("<=")) {
        issues.hasError = true;
        issues.title = "Assignment inside Condition (SyntaxError)";
        issues.why = `Line ${i + 1} contains a single equals sign inside condition: "${line}". A single '=' assigns a value, it doesn't compare them.`;
        issues.how = "Replace the single equals sign '=' with double equals '==' to perform comparison.";
        
        let newLines = [...lines];
        newLines[i] = lines[i].replace("=", "==");
        issues.corrected = newLines.join("\n");
        issues.errorLines.push(i + 1);
        return issues;
      }
    }

    // Rule 3: Indentation check
    let currentIndent = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "") continue;
      
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      
      // If previous line ended with colon, this line MUST have higher indent
      if (i > 0) {
        const prevLine = lines[i - 1].trim();
        if (prevLine.endsWith(":") && indent <= currentIndent) {
          issues.hasError = true;
          issues.title = "Indentation Mismatch (IndentationError)";
          issues.why = `Line ${i + 1} follows a block header but has incorrect indentation.`;
          issues.how = "Indent this line with 4 spaces (or one Tab) relative to the preceding header.";
          
          let newLines = [...lines];
          newLines[i] = "    " + lines[i];
          issues.corrected = newLines.join("\n");
          issues.errorLines.push(i + 1);
          return issues;
        }
      }
      currentIndent = indent;
    }

    // Rule 4: Check for undefined variables (NameError)
    let definedVars = new Set();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Track assignments (var = ...)
      const assignMatch = line.match(/^(\w+)\s*=/);
      if (assignMatch) {
        definedVars.add(assignMatch[1]);
      }
      
      // Track for loop variables (for var in ...)
      const forMatch = line.match(/^for\s+(\w+)\s+in\s+/);
      if (forMatch) {
        definedVars.add(forMatch[1]);
      }
      
      // Track function definitions (def funcname(...):)
      const defMatch = line.match(/^def\s+(\w+)\s*\(/);
      if (defMatch) {
        definedVars.add(defMatch[1]);
      }
    }
    
    // Now check if used variables are defined
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip assignment lines and comments
      if (line.includes("=") && !line.startsWith("if ") && !line.startsWith("elif ")) continue;
      if (line.startsWith("#")) continue;
      
      // Extract variable names used in print(), len(), type(), etc.
      const funcCalls = line.match(/\b(print|len|type|str|int|float|sum|abs|max|min)\s*\(([^)]*)\)/g);
      if (funcCalls) {
        for (let funcCall of funcCalls) {
          const argsMatch = funcCall.match(/\(([^)]*)\)/);
          if (argsMatch) {
            const args = argsMatch[1];
            // Extract variable names (alphanumeric + underscore)
            const varMatches = args.match(/\b([a-zA-Z_]\w*)\b/g);
            if (varMatches) {
              for (let varName of varMatches) {
                if (!definedVars.has(varName) && !["True", "False", "None"].includes(varName)) {
                  issues.hasError = true;
                  issues.title = "Undefined Variable (NameError)";
                  issues.why = `Line ${i + 1} uses variable "${varName}" but it was never defined. Did you mean one of these? ${Array.from(definedVars).join(", ") || "No variables defined yet."}`;
                  issues.how = `Define the variable before using it, or check the spelling. Available variables: ${Array.from(definedVars).join(", ") || "None"}`;
                  issues.errorLines.push(i + 1);
                  return issues;
                }
              }
            }
          }
        }
      }
    }

    return issues;
  }

  renderReport(issues) {
    if (issues.hasError) {
      this.reportContainer.innerHTML = `
        <div style="color: var(--accent-red); font-weight: 700; margin-bottom: 8px;">
          <i class="fa-solid fa-triangle-exclamation"></i> ${issues.title}
        </div>
        <p style="margin-bottom: 10px;"><strong>Error details:</strong> ${issues.why}</p>
        <p style="margin-bottom: 10px;"><strong>How to fix:</strong> ${issues.how}</p>
        <div style="background-color: var(--bg-primary); padding: 12px; border-radius: 12px; border: 1px solid var(--border-color); font-family: monospace; position: relative;">
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;"># Recommended Correction:</div>
          <span style="color: #a8ff60; white-space: pre-wrap;">${issues.corrected}</span>
        </div>
      `;
    } else {
      this.reportContainer.innerHTML = `
        <div style="color: var(--accent-green); font-weight: 700; margin-bottom: 8px;">
          <i class="fa-solid fa-circle-check"></i> Code Validated Successfully
        </div>
        <p style="margin-bottom: 10px;"><strong>Analysis:</strong> ${issues.why}</p>
        <p>You can see step-by-step how your code executes inside the interactive visualizer below!</p>
      `;
    }
  }

  generateExecutionSteps(code, hasError) {
    // If code has errors, don't simulate steps, focus on correction
    if (hasError) return [];

    const cleanLines = code.split("\n").map(l => l.trim());
    
    // Default fallback steps for loops demonstration if user pastes loop-based math
    // We search for a variable assignment followed by a for loop
    let initVar = "total";
    let initVal = 0;
    let loopVar = "i";
    let rangeStart = 1;
    let rangeEnd = 4;
    
    // Parse custom names where possible
    let hasMatch = false;
    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i];
      
      // Look for loop
      if (/^for\s+(\w+)\s+in\s+range\s*\((.*?)\):?$/.test(line)) {
        const match = line.match(/^for\s+(\w+)\s+in\s+range\s*\((.*?)\):?$/);
        loopVar = match[1];
        const rangeArgs = match[2].split(",").map(a => parseInt(a.trim()));
        if (rangeArgs.length === 1) {
          rangeStart = 0;
          rangeEnd = rangeArgs[0];
        } else if (rangeArgs.length === 2) {
          rangeStart = rangeArgs[0];
          rangeEnd = rangeArgs[1];
        }
        hasMatch = true;
      }
      // Look for var assignment
      if (/^(\w+)\s*=\s*(\d+)$/.test(line)) {
        const match = line.match(/^(\w+)\s*=\s*(\d+)$/);
        initVar = match[1];
        initVal = parseInt(match[2]);
      }
    }

    if (!hasMatch) {
      // General non-loop code steps: simulate standard operations
      return [
        { lineNum: 1, desc: "Create and initialize variables.", vars: { info: "Initializing script" } },
        { lineNum: 2, desc: "Execute operations line by line.", vars: { info: "Computing expressions" } },
        { lineNum: code.split("\n").length, desc: "Script complete.", vars: { info: "Console printed" } }
      ];
    }

    // Dynamic steps builder for loops
    let steps = [];
    let currentVal = initVal;

    // Step 1: Init variables
    steps.push({
      lineNum: this.findLineIndex(code, `${initVar} =`),
      desc: `Initialize variable <code>${initVar}</code> to <code>${initVal}</code>.`,
      vars: { [initVar]: currentVal }
    });

    // Loop steps
    for (let i = rangeStart; i < rangeEnd; i++) {
      steps.push({
        lineNum: this.findLineIndex(code, `for ${loopVar} in`),
        desc: `Loop iterator <code>${loopVar}</code> set to <code>${i}</code>.`,
        vars: { [initVar]: currentVal, [loopVar]: i }
      });

      currentVal += i;
      steps.push({
        lineNum: this.findLineIndex(code, `${initVar} =`),
        desc: `Add <code>${loopVar}</code> (${i}) to <code>${initVar}</code>. New total is <code>${currentVal}</code>.`,
        vars: { [initVar]: currentVal, [loopVar]: i }
      });
    }

    // Print step
    steps.push({
      lineNum: this.findLineIndex(code, "print("),
      desc: `Print final value of <code>${initVar}</code> to console. Output: <code>${currentVal}</code>`,
      vars: { [initVar]: currentVal }
    });

    return steps;
  }

  findLineIndex(code, keyword) {
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(keyword)) {
        return i + 1; // 1-indexed
      }
    }
    return 1;
  }

  renderStepsSelector() {
    this.stepsRow.innerHTML = "";
    this.currentSteps.forEach((step, idx) => {
      const dot = document.createElement("div");
      dot.className = `step-dot ${idx === 0 ? "active" : ""}`;
      dot.innerText = idx + 1;
      dot.addEventListener("click", () => {
        // Toggle active
        document.querySelectorAll(".step-dot").forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
        this.activeStepIndex = idx;
        this.renderActiveStep();
      });
      this.stepsRow.appendChild(dot);
    });
  }

  renderActiveStep() {
    const step = this.currentSteps[this.activeStepIndex];
    if (!step) return;

    // Highlight line in code visualization
    const code = this.editor.value;
    const lines = code.split("\n");
    
    let codeHtml = "";
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const isActive = lineNum === step.lineNum;
      codeHtml += `<div class="viz-line ${isActive ? "active" : ""}">${this.escapeHtml(line || " ")}</div>`;
    });

    // Populate Variables pane
    let varsHtml = "";
    for (const [key, value] of Object.entries(step.vars)) {
      varsHtml += `
        <div class="var-row">
          <span style="color: var(--accent-cyan); font-weight: 600;">${key}</span>
          <span style="color: #a8ff60;">${value}</span>
        </div>
      `;
    }

    this.vizArea.innerHTML = `
      <div>
        <div class="viz-code-block">${codeHtml}</div>
        <p style="font-size: 13px; color: var(--text-primary); margin-top: 14px; line-height: 1.5;">
          <strong>Action:</strong> ${step.desc}
        </p>
      </div>
      <div class="viz-variables">
        <div class="variables-title">Variables Scope</div>
        ${varsHtml}
      </div>
    `;
  }

  async analyzeBuggyCode() {
    const code = this.editor ? this.editor.value : '';
    if (!code.trim()) {
      this.console.innerText = "> Error: Please enter Python code first.";
      this.console.classList.add("error");
      return;
    }

    this.console.innerText = "> Loading Python runtime and running your complete program...";
    this.console.classList.remove("error");
    this.analyzeBtn.disabled = true;
    if (window.PyNovaState) {
      window.PyNovaState.incrementDebugCount();
      window.PyNovaState.addActivity("Debugger Run", "Analyzed a complete Python program in Pyodide.");
    }

    try {
      const runner = window.PyNovaPyodideRunner || window.pyodideRunner;
      if (!runner || typeof runner.runCode !== 'function') {
        throw new Error('The shared Pyodide runner is unavailable.');
      }
      const syntaxAnalysis = await this.repairSyntaxIteratively(code, runner);
      const result = syntaxAnalysis.parse.ok
        ? await runner.runCode(syntaxAnalysis.code, 'debugger-console')
        : { success: false, errorName: syntaxAnalysis.parse.type, errorMessage: syntaxAnalysis.parse.message, traceback: syntaxAnalysis.parse.traceback, output: '' };
      const issues = result.success && syntaxAnalysis.repairs.length === 0
        ? this.buildSuccessReport(code, result.output)
        : this.buildErrorReport(code, result, syntaxAnalysis);
      this.renderReport(issues);
      this.currentSteps = this.generateExecutionSteps(code, issues.hasError);
      this.activeStepIndex = 0;
      if (this.currentSteps.length > 0) {
        this.visualizer.style.display = "flex";
        this.renderStepsSelector();
        this.renderActiveStep();
      } else {
        this.visualizer.style.display = "none";
      }
      this.console.innerText = issues.hasError ? "> Execution finished with an error." : "> No errors found. Program executed successfully.";
      this.console.classList.toggle("error", issues.hasError);
    } catch (error) {
      this.console.innerText = `> Debugger failed: ${error.message || error}`;
      this.console.classList.add("error");
    } finally {
      this.analyzeBtn.disabled = false;
    }
  }

  async repairSyntaxIteratively(code, runner) {
    let candidate = code;
    const repairs = [];
    let parse = await this.parseWithPyodide(candidate, runner);
    const maxRepairs = 25;

    for (let attempt = 0; !parse.ok && attempt < maxRepairs; attempt++) {
      const repair = this.repairSyntax(candidate, parse);
      if (!repair) break;
      candidate = repair.code;
      repairs.push(repair);
      parse = await this.parseWithPyodide(candidate, runner);
    }

    return { code: candidate, parse, repairs };
  }

  async parseWithPyodide(code, runner) {
    if (!runner || typeof runner.ensureLoaded !== 'function' || !(await runner.ensureLoaded())) {
      return { ok: false, type: 'RuntimeError', message: 'Python runtime could not be loaded.', traceback: '' };
    }

    try {
      const source = JSON.stringify(code);
      const raw = runner.pyodide.runPython(`
import ast, json, traceback
_debug_source = ${source}
try:
    compile(_debug_source, '<debugger>', 'exec')
    _debug_result = {'ok': True, 'type': '', 'message': '', 'lineno': None, 'offset': None, 'traceback': ''}
except BaseException as _debug_error:
    _debug_result = {
        'ok': False,
        'type': type(_debug_error).__name__,
        'message': str(_debug_error),
        'lineno': getattr(_debug_error, 'lineno', None),
        'offset': getattr(_debug_error, 'offset', None),
        'end_lineno': getattr(_debug_error, 'end_lineno', None),
        'end_offset': getattr(_debug_error, 'end_offset', None),
        'text': getattr(_debug_error, 'text', None),
        'traceback': traceback.format_exc()
    }
json.dumps(_debug_result)
`);
      return JSON.parse(String(raw));
    } catch (error) {
      return { ok: false, type: 'RuntimeError', message: error.message || String(error), traceback: '' };
    }
  }

  repairSyntax(code, parse) {
    if (!['SyntaxError', 'IndentationError', 'TabError'].includes(parse.type)) return null;
    const lineNumber = Number(parse.lineno);
    const lineIndex = lineNumber - 1;
    const lines = code.split('\n');
    if (!Number.isInteger(lineNumber) || !lines[lineIndex]) return null;
    const originalLine = lines[lineIndex];
    const trimmedLine = originalLine.trim();
    const message = String(parse.message || '').toLowerCase();

    if (message.includes("expected ':'") || message.includes("expected ':'".replace("'", ''))) {
      const blockHeader = /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/;
      if (blockHeader.test(trimmedLine) && !trimmedLine.endsWith(':')) {
        const commentIndex = originalLine.indexOf('#');
        const header = commentIndex >= 0 ? originalLine.slice(0, commentIndex).trimEnd() : originalLine.trimEnd();
        const comment = commentIndex >= 0 ? originalLine.slice(commentIndex) : '';
        lines[lineIndex] = `${header}:${comment ? ` ${comment}` : ''}`;
        return { code: lines.join('\n'), line: lineNumber, description: `Added the missing ':' on line ${lineNumber}.` };
      }
    }

    const unclosedBracket = message.match(/[([{]/);
    if (message.includes('was never closed') && unclosedBracket) {
      const closer = { '(': ')', '[': ']', '{': '}' }[unclosedBracket[0]];
      return { code: `${code}${closer}`, line: lineNumber, description: `Added the missing '${closer}' for line ${lineNumber}.` };
    }

    if (message.includes('unmatched')) {
      const closing = trimmedLine.match(/[)\]}]/);
      if (closing) {
        const position = originalLine.indexOf(closing[0]);
        lines[lineIndex] = `${originalLine.slice(0, position)}${originalLine.slice(position + 1)}`;
        return { code: lines.join('\n'), line: lineNumber, description: `Removed the unmatched '${closing[0]}' on line ${lineNumber}.` };
      }
    }

    if (message.includes('unterminated string') || message.includes('eol while scanning string')) {
      const quote = (trimmedLine.match(/(^|[^\\])'/g) || []).length % 2 ? "'" : ((trimmedLine.match(/(^|[^\\])"/g) || []).length % 2 ? '"' : '');
      if (quote) return { code: `${code}\n${quote}`, line: lineNumber, description: `Closed the unterminated ${quote} string reported on line ${lineNumber}.` };
    }

    if (parse.type === 'TabError') {
      const normalized = lines.map(line => line.replace(/\t/g, '    '));
      if (normalized.join('\n') !== code) return { code: normalized.join('\n'), line: lineNumber, description: 'Replaced tabs with four-space indentation.' };
    }

    if (parse.type === 'IndentationError' && message.includes('unexpected indent')) {
      const indentation = originalLine.match(/^\s*/)?.[0] || '';
      if (indentation) {
        lines[lineIndex] = originalLine.slice(indentation.length);
        return { code: lines.join('\n'), line: lineNumber, description: `Removed unexpected indentation on line ${lineNumber}.` };
      }
    }
    return null;
  }

  buildSuccessReport(code, output) {
    const logicalIssue = this.detectLogicalIssue(code);
    return {
      hasError: false,
      title: 'No errors found',
      why: 'Python parsed and executed the complete program successfully.',
      how: output ? `Program output:\n${output}` : 'The program completed without producing output.',
      logicalIssue,
      corrected: code,
      errorLines: []
    };
  }

  buildErrorReport(code, result, syntaxAnalysis = { code, repairs: [] }) {
    const analyzedCode = syntaxAnalysis.code || code;
    const traceback = result.traceback || result.errorMessage || '';
    const tracebackLines = traceback.match(/File ["'][^"']+["'], line (\d+)/g) || [];
    const lineNumber = tracebackLines.length ? Number(tracebackLines[tracebackLines.length - 1].match(/line (\d+)/)[1]) : null;
    const sourceLines = analyzedCode.split('\n');
    const sourceLine = lineNumber && sourceLines[lineNumber - 1] !== undefined ? sourceLines[lineNumber - 1] : '';
    const correction = result.success ? { code: analyzedCode, explanation: 'The syntax repairs were applied to the suggested version and the corrected program executed successfully.' } : this.suggestCorrection(analyzedCode, result.errorName || 'PythonError', result.errorMessage || '', lineNumber);
    const isTimeout = result.errorName === 'TimeoutError';
    const errorsFound = syntaxAnalysis.repairs.map(repair => `Line ${repair.line} - ${repair.description}`);
    if (!result.success) errorsFound.push(`${lineNumber ? `Line ${lineNumber}` : 'Runtime'} - ${result.errorName || 'PythonError'}: ${result.errorMessage || 'Python raised an exception.'}`);
    return {
      hasError: true,
      title: isTimeout ? 'Execution timed out' : `${result.errorName || 'PythonError'} detected`,
      errorType: result.errorName || 'PythonError',
      errorMessage: result.errorMessage || 'Python raised an exception.',
      lineNumber,
      sourceLine,
      output: result.output || '',
      traceback,
      why: isTimeout ? 'Execution was stopped after 10 seconds to keep the webpage responsive.' : this.explainPythonError(result.errorName, result.errorMessage, sourceLine),
      how: `${syntaxAnalysis.repairs.length ? `${syntaxAnalysis.repairs.map(repair => repair.description).join(' ')} ` : ''}${correction.explanation}`,
      corrected: correction.code,
      canApplyFix: correction.code !== code,
      errorsFound,
      logicalIssue: this.detectLogicalIssue(analyzedCode)
    };
  }

  explainPythonError(errorType, message, sourceLine) {
    if (errorType === 'NameError') return `Python could not find the referenced name. Check its spelling and define it before this line${sourceLine ? `: ${sourceLine.trim()}` : '.'}`;
    if (errorType === 'TypeError') return `An operation or function received a value of an incompatible type${message ? `: ${message}` : '.'}`;
    if (errorType === 'IndexError') return `The program requested a sequence position that does not exist${message ? `: ${message}` : '.'}`;
    if (errorType === 'KeyError') return `The dictionary does not contain the requested key${message ? `: ${message}` : '.'}`;
    if (errorType === 'ZeroDivisionError') return 'A division or modulo operation used zero as its denominator.';
    if (errorType === 'SyntaxError' || errorType === 'IndentationError' || errorType === 'TabError') return `Python could not parse this program${message ? `: ${message}` : '.'}`;
    return `Python raised ${errorType || 'an exception'} while executing the program${message ? `: ${message}` : '.'}`;
  }

  detectLogicalIssue(code) {
    const match = code.match(/range\s*\(\s*len\s*\(\s*([A-Za-z_]\w*)\s*\)\s*\+\s*1\s*\)/);
    if (!match) return '';
    return `Possible logical issue: range(len(${match[1]}) + 1) visits one index beyond the last item and can raise IndexError. Use range(len(${match[1]})) when iterating by index.`;
  }

  suggestCorrection(code, errorType, message, lineNumber) {
    const lines = code.split('\n');
    const lineIndex = lineNumber ? lineNumber - 1 : -1;
    if ((errorType === 'SyntaxError' || errorType === 'IndentationError' || errorType === 'TabError') && lineIndex >= 0) {
      if (message.includes('expected') && message.includes(':') && !lines[lineIndex].trim().endsWith(':')) {
        const corrected = [...lines];
        corrected[lineIndex] = `${corrected[lineIndex]}:`;
        return { code: corrected.join('\n'), explanation: `Line ${lineNumber} is a Python block header and needs a trailing colon.` };
      }
      if (message.includes('was never closed')) {
        const bracket = message.match(/[([{]/)?.[0];
        const closer = bracket ? ({ '(': ')', '[': ']', '{': '}' }[bracket]) : ')';
        return { code: `${code}${closer}`, explanation: `Python reports an unclosed ${bracket || 'grouping'}; the suggested correction closes it.` };
      }
      if (message.includes('unmatched')) {
        const corrected = [...lines];
        corrected[lineIndex] = corrected[lineIndex].replace(/[)\]}]/, '');
        return { code: corrected.join('\n'), explanation: `Line ${lineNumber} contains an unmatched closing bracket.` };
      }
    }

    if (errorType === 'NameError') {
      const name = message.match(/name ['"]([^'"]+)['"] is not defined/)?.[1];
      const defined = [...code.matchAll(/(?:^|\n)\s*(?:def|class)\s+([A-Za-z_]\w*)|(?:^|\n)\s*([A-Za-z_]\w*)\s*=/g)].map(match => match[1] || match[2]).filter(Boolean);
      const suggestion = name && defined.sort((a, b) => this.editDistance(name, a) - this.editDistance(name, b))[0];
      if (name && suggestion && this.editDistance(name, suggestion) <= 3) {
        const corrected = code.replace(new RegExp(`\\b${name}\\b`, 'g'), suggestion);
        return { code: corrected, explanation: `Python reports that '${name}' is undefined. The closest defined name is '${suggestion}', so the reference was corrected.` };
      }
    }

    return { code, explanation: 'Unable to safely determine the intended correction. Correct the indicated line and run Debug again.' };
  }

  editDistance(left, right) {
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= right.length; j++) {
        const above = row[j];
        row[j] = left[i - 1] === right[j - 1] ? diagonal : 1 + Math.min(diagonal, above, row[j - 1]);
        diagonal = above;
      }
    }
    return row[right.length];
  }

  renderReport(issues) {
    const output = issues.output ? `<div class="debugger-detail"><strong>Program output before the error:</strong><pre>${this.escapeHtml(issues.output)}</pre></div>` : '';
    const traceback = issues.traceback ? `<details class="debugger-traceback"><summary>Full traceback</summary><pre>${this.escapeHtml(issues.traceback)}</pre></details>` : '';
    if (!issues.hasError) {
      const logicalWarning = issues.logicalIssue ? `<div class="debugger-warning"><strong>Possible logical issue</strong><p>${this.escapeHtml(issues.logicalIssue.replace(/^Possible logical issue:\s*/, ''))}</p></div>` : '';
      this.reportContainer.innerHTML = `<div class="debugger-success"><i class="fa-solid fa-circle-check"></i> No errors found</div><p>${this.escapeHtml(issues.why)}</p>${logicalWarning}<div class="debugger-detail"><strong>${issues.how.includes('Program output') ? 'Program output' : 'Result'}:</strong><pre>${this.escapeHtml(issues.how.replace(/^Program output:\n?/, ''))}</pre></div>`;
      return;
    }

    const line = issues.lineNumber ? `<p><strong>Line:</strong> ${issues.lineNumber}${issues.sourceLine ? ` <code>${this.escapeHtml(issues.sourceLine.trim())}</code>` : ''}</p>` : '';
    const errorsFound = issues.errorsFound?.length ? `<div class="debugger-detail"><strong>Errors found:</strong><ol>${issues.errorsFound.map(error => `<li>${this.escapeHtml(error)}</li>`).join('')}</ol></div>` : '';
    const logicalWarning = issues.logicalIssue ? `<div class="debugger-warning"><strong>Possible logical issue</strong><p>${this.escapeHtml(issues.logicalIssue.replace(/^Possible logical issue:\s*/, ''))}</p></div>` : '';
    const correction = `<div class="debugger-correction"><strong>Suggested correction:</strong><pre>${this.escapeHtml(issues.corrected)}</pre>${issues.canApplyFix ? '<button class="btn btn-primary" id="debugger-apply-fix-btn" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i> Apply Fix</button>' : '<p class="debugger-muted">No automatic fix was applied because the intended behavior is ambiguous.</p>'}</div>`;
    this.reportContainer.innerHTML = `<div class="debugger-error"><i class="fa-solid fa-triangle-exclamation"></i> Error detected</div>${errorsFound}<p><strong>Error:</strong> ${this.escapeHtml(issues.errorType)}</p>${line}<p><strong>Message:</strong> ${this.escapeHtml(issues.errorMessage)}</p><p><strong>Why this happened:</strong> ${this.escapeHtml(issues.why)}</p>${logicalWarning}<p><strong>Correction:</strong> ${this.escapeHtml(issues.how)}</p>${output}${traceback}${correction}`;
    const applyButton = document.getElementById('debugger-apply-fix-btn');
    if (applyButton) applyButton.addEventListener('click', () => {
      this.editor.value = issues.corrected;
      this.editor.dispatchEvent(new Event('input', { bubbles: true }));
      this.syncLineNumbers();
      this.editor.focus();
      this.console.innerText = '> Fix applied. Run Debug again to verify the complete program.';
    });
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Expose on load
window.addEventListener("DOMContentLoaded", () => {
  window.PyNovaDebugger = new DebuggerController();
  // sync initial numbers
  if (window.PyNovaDebugger.editor) {
    window.PyNovaDebugger.syncLineNumbers();
  }
});
