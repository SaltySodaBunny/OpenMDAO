// <<hpp_insert gen/Layout.js>>

/**
 * Calculates and stores the size and positions of visible elements.
 * @typedef OmLayout
 * @property {ModelData} model Reference to the preprocessed model.
 * @property {OmTreeNode} zoomedElement Reference to zoomedElement managed by N2Diagram.
 * @property {OmTreeNode[]} zoomedNodes  Child workNodes of the current zoomed element.
 * @property {OmTreeNode[]} visibleNodes Zoomed workNodes that are actually drawn.
 * @property {OmTreeNode[]} zoomedSolverNodes Child solver workNodes of the current zoomed element.
 * @property {Object} svg Reference to the top-level SVG element in the document.
 * @property {Object} size The dimensions of the model and solver trees.
 */
class OmLayout extends Layout {
    /**
     * Compute the new layout based on the model data and the zoomed element.
     * @param {ModelData} model The pre-processed model object.
     * @param {Object} newZoomedElement The element the new layout is based around.
     * @param {Object} dims The initial sizes for multiple tree elements.
     * @param {Boolean} showLinearSolverNames Whether to show linear or non-linear solver names.
     * @param {Boolean} showSolvers Whether to display the solver tree.
     */
    constructor(model, zoomedElement, dims, showLinearSolverNames, showSolvers) {
        super(model, zoomedElement, dims, false);

        this.zoomedSolverNodes = [];
        this.visibleSolverNodes = [];
        this.showLinearSolverNames = showLinearSolverNames;
        this.showSolvers = showSolvers;
        this._init();
    }

    _init() {
        super._init();
        if (this.showSolvers) {
            this._computeSolverColumnWidths();
            this._setColumnLocations(this.size.solverTree, this.solverCols);
            this._computeSolverNormalizedPositions(this.model.root, 0, false, null);
            if (this.zoomedElement.parent) {
                this.zoomedSolverNodes.push(this.zoomedElement.parent);
            }

            this.scales.solver = new Scale(this.size.solverTree);
        }

        this.transitCoords.solver = new Dimensions({x: 0, y: 0});

        return this;
    }

    /**
     * Return the name of the linear or non-linear solver depending
     * on the current setting.
     * @param {OmTreeNode} node The item to get the solver text from.
     */
     getSolverText(node) {
        let solver_name = this.showLinearSolverNames ? node.linear_solver : node.nonlinear_solver;

        if (!this.showLinearSolverNames && node.hasOwnProperty("solve_subsystems") && node.solve_subsystems) {
            return solver_name + " (sub_solve)";
        }
        else {
            return solver_name;
        }
    }

    /**
     * Determine text widths for all descendents of the specified node.
     * @param {OmTreeNode} [node = this.zoomedElement] Item to begin looking from.
     */
     _updateTextWidths(node = this.zoomedElement) {
        if (node.draw.hidden) return;
        super._updateTextWidths(node);

        if (!node.isInputOrOutput()) {
            node.draw.nameSolverWidthPx = this._getTextWidth(this.getSolverText(node)) + 2 *
                this.size.rightTextMargin;
        }
    }

    /**
     * Compute solver column widths across the model, then adjust ends as needed.
     * @param {OmTreeNode} [node = this.zoomedElement] Item to operate on.
     */
     _computeSolverColumnWidths(node = this.zoomedElement) {
        this.greatestDepth = 0;
        this.leafSolverWidthsPx = new Array(this.model.maxDepth + 1).fill(0.0);
        this.solverCols = Array.from({length: this.model.maxDepth + 1},
            () => ({ 'width': 0.0, 'location': 0.0 }));

        this._setColumnWidthsFromWidestText(node, 'subsystem_children', this.solverCols,
            this.leafSolverWidthsPx, 'nameSolverWidthPx');

        let sum = 0;
        let lastColumnWidth = 0;
        for (let i = this.leafSolverWidthsPx.length - 1; i >= this.zoomedElement.depth; --i) {
            sum += this.solverCols[i].width;
            const lastWidthNeeded = this.leafSolverWidthsPx[i] - sum;
            lastColumnWidth = Math.max(lastWidthNeeded, lastColumnWidth);
        }

        this.solverCols[this.zoomedElement.depth - 1].width = this.size.parentNodeWidth;
        this.solverCols[this.greatestDepth].width = lastColumnWidth;
    }


    /**TODO: _computeNormalizedPositions and _computeSolverNormalizedPositions do almost
     * identical things, just storing info in different variables, so they should be
     * merged as much as possible.
     */

    /**
     * Recurse over the model tree and determine the coordinates and size of visible
     * solver nodes. If a parent is minimized, operations are performed on it instead.
     * @param {OmTreeNode} node The node to operate on.
     * @param {number} leafCounter Tally of leaves encountered so far.
     * @param {Boolean} isChildOfZoomed Whether node is a descendant of this.zoomedElement.
     * @param {Object} earliestMinimizedParent The minimized parent, if any, appearing
     *   highest in the tree hierarchy. Null if none exist.
     */
     _computeSolverNormalizedPositions(node, leafCounter,
        isChildOfZoomed, earliestMinimizedParent) {

        // Fix until solver display is removed entirely from generic code:
        if (!(node instanceof OmTreeNode)) return;

        if (!isChildOfZoomed) {
            isChildOfZoomed = (node === this.zoomedElement);
        }

        if (earliestMinimizedParent == null && isChildOfZoomed) {
            if (node.type.match(/^(subsystem|root)$/)) {
                this.zoomedSolverNodes.push(node);
            }
            if (node.isVisibleLeaf()) { //at a "leaf" workNode
                if (!node.isInput()) {
                    this.visibleSolverNodes.push(node);
                }
                earliestMinimizedParent = node;
            }
            else if (node.draw.filtered) {
                earliestMinimizedParent = node.draw.filterParent;
            }
        }

        node.preserveDims(true, leafCounter);
        const workNode = (earliestMinimizedParent) ? earliestMinimizedParent : node;
        const dims = node.draw.solverDims;

        if (! node.isVisible()) { //input or hidden leaf leaving
            dims.x = this.cols[node.parentComponent.depth + 1].location /
                this.size.partitionTree.width;
            dims.y = node.parentComponent.draw.dims.y;
            dims.width = 1e-6;
            dims.height = 1e-6;
        }
        else {
            dims.x = this.solverCols[workNode.depth].location / this.size.solverTree.width;
            dims.y = leafCounter / this.model.root.draw.numLeaves;
            dims.width = (node.subsystem_children && !node.draw.minimized) ?
                (this.solverCols[workNode.depth].width / this.size.solverTree.width) :
                1 - workNode.draw.solverDims.x;
    
            dims.height = workNode.draw.numLeaves / this.model.root.draw.numLeaves;
        }

        if (node.hasChildren()) {
            for (const child of node.children) {
                if (!child.isInputOrOutput() || !child.draw.minimized) {
                    this._computeSolverNormalizedPositions(child,
                        leafCounter, isChildOfZoomed,
                        child.draw.filterParent? child.draw.filterParent : earliestMinimizedParent);
                    if (earliestMinimizedParent == null) { //numleaves is only valid passed nonminimized nodes
                        leafCounter += child.draw.numLeaves;
                    }
                }
            }
        }
    }

    /**
     * Calculate new dimensions for the div element enclosing the main SVG element.
     * @returns {Object} Members width and height as strings with the unit appended.
     */
     newOuterDims() {
        const dims = super.newOuterDims();
        dims.width += this.size.solverTree.width;

        return dims;
    }

    /**
     * Calculate new dimensions for the main SVG element.
     * @returns {Object} Members width and height as numbers.
     */
    newInnerDims() {
        const dims = super.newInnerDims();
        dims.width += this.size.solverTree.width;

        return dims;
    }

    /**
     * Update container element dimensions when a new layout is calculated,
     * and set up transitions.
     * @param {Object} dom References to HTML elements.
     * @param {number} transitionStartDelay ms to wait before performing transition
     */
     updateTransitionInfo(dom, transitionStartDelay, manuallyResized) {
         super.updateTransitionInfo(dom, transitionStartDelay, manuallyResized);
         const innerDims = this.newInnerDims();

         dom.pSolverTreeGroup.transition(sharedTransition)
            .attr("height", innerDims.height)
            .attr("transform", "translate(" + (this.size.partitionTree.width +
                innerDims.margin +
                innerDims.height +
                innerDims.margin) + " " +
                innerDims.margin + ")");         
     }

    calcWidthBasedOnNewHeight(height) {
        return super.calcWidthBasedOnNewHeight(height) + this.size.solverTree.width;
    }

    calcHeightBasedOnNewWidth(width) {
        return super.calcHeightBasedOnNewWidth(width) - this.size.solverTree.width;
    }

    /**
     * Make a copy of the previous transit coordinates and linear scalers before
     * setting new ones.
     */
     preservePreviousScaleValues() {
        super.preservePreviousScaleValues()

        this.transitCoords.solver.preserve();
        this.scales.solver.preserve();
    }

    updateScaleValues() {
        super.updateScaleValues();
        const elemDims = this.zoomedElement.draw.solverDims;
        const treeSize = this.size.solverTree;

        this.transitCoords.solver.x = (elemDims.x ?
            treeSize.width - this.size.parentNodeWidth : treeSize.width) / (1 - elemDims.x);

        this.transitCoords.solver.y = treeSize.height / elemDims.height;

        this.scales.solver.x
            .domain([elemDims.x, 1])
            .range([elemDims.x ? this.size.parentNodeWidth : 0, treeSize.width]);

        this.scales.solver.y
            .domain([elemDims.y, elemDims.y + elemDims.height])
            .range([0, treeSize.height]);        
    }
}
