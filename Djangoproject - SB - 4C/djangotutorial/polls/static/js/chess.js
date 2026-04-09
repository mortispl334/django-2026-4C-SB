/**
 * CHESS ARENA - FULL ENGINE + UI + DRAG & DROP
 * Pełna logika: bicie w przelocie, roszady, promocje, mat/pat.
 * UI: Drag & Drop, Canvas Arrows, Heatmap, Flip Board, PGN Export.
 */

(function() {
    // --- ELEMENTY DOM ---
    const boardEl = document.getElementById("board");
    const canvas = document.getElementById("arrowCanvas");
    const ctx = canvas.getContext("2d");
    const turnInfo = document.getElementById("turnInfo");
    const historyList = document.getElementById("history-list");
    const promoModal = document.getElementById("promo-modal");
    const promoPieces = document.getElementById("promo-pieces");
    const gameAlert = document.getElementById("game-alert");
    const evalWhite = document.getElementById("eval-white");

    // --- STAN GRY ---
    let board = [];
    let currentPlayer = "white"; 
    let selectedSq = null; 
    let gameOver = false;
    
    // Zmienne silnika
    let castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
    let enPassantTarget = null; 
    let fullMoveNumber = 1;
    let pgnMoves = [];

    // Zmienne UI & Interakcji
    let isDrawingArrow = false;
    let arrowStartSq = null;
    let savedArrows = [];
    let isHeatmapActive = false;
    let awaitingPromotion = null;
    
    // Zmienne Drag & Drop
    let isDragging = false;
    let draggedPieceEl = null;
    let dragStartSq = null; // {r, c}

    const ICONS = {
        r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟",
        R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", P: "♙"
    };

    const START_POS = [
        ["r", "n", "b", "q", "k", "b", "n", "r"],
        ["p", "p", "p", "p", "p", "p", "p", "p"],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ["P", "P", "P", "P", "P", "P", "P", "P"],
        ["R", "N", "B", "Q", "K", "B", "N", "R"]
    ];

    const DIRS = {
        knight: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
        bishop: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
        rook: [[-1, 0], [1, 0], [0, -1], [0, 1]],
        king: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
    };
    DIRS.queen = [...DIRS.bishop, ...DIRS.rook];

    // --- INICJALIZACJA ---
    function initGame() {
        board = START_POS.map(row => [...row]);
        currentPlayer = "white";
        selectedSq = null;
        gameOver = false;
        castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
        enPassantTarget = null;
        fullMoveNumber = 1;
        pgnMoves = [];
        savedArrows = [];
        isHeatmapActive = false;
        awaitingPromotion = null;
        
        if (historyList) historyList.innerHTML = "";
        if (gameAlert) gameAlert.style.display = "none";
        
        resizeCanvas();
        renderBoard();
        updateUI();
    }

    // --- RENDEROWANIE PLANSZY ---
    function renderBoard() {
        boardEl.innerHTML = "";
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = document.createElement("div");
                sq.className = `square ${(r + c) % 2 === 0 ? 'white' : 'black'}`;
                sq.dataset.row = r;
                sq.dataset.col = c;

                const piece = board[r][c];
                if (piece) {
                    const span = document.createElement("span");
                    span.textContent = ICONS[piece];
                    span.className = isWhite(piece) ? "p-white" : "p-black";
                    sq.appendChild(span);
                }

                // Eventy myszy
                sq.addEventListener("mousedown", (e) => handleMouseDown(e, r, c));
                sq.addEventListener("click", () => handleSquareClick(r, c));
                
                boardEl.appendChild(sq);
            }
        }
        if (isHeatmapActive) renderHeatmap();
    }

    // --- MODUŁ DRAG & DROP ---
    function handleMouseDown(e, r, c) {
        if (gameOver || awaitingPromotion || e.button !== 0) return;

        const piece = board[r][c];
        if (piece && getColor(piece) === currentPlayer) {
            isDragging = true;
            dragStartSq = { r, c };
            
            const sqEl = getSquareElement(r, c);
            draggedPieceEl = sqEl.querySelector('span');
            
            if (draggedPieceEl) {
                draggedPieceEl.classList.add("dragging");
                draggedPieceEl.style.position = 'fixed';
                draggedPieceEl.style.zIndex = '1000';
                draggedPieceEl.style.pointerEvents = 'none';
                moveDraggedPiece(e);
                
                clearHighlights();
                highlightLegalMoves(r, c);
            }
        }
    }

    function moveDraggedPiece(e) {
        if (isDragging && draggedPieceEl) {
            draggedPieceEl.style.left = (e.clientX - 25) + 'px';
            draggedPieceEl.style.top = (e.clientY - 25) + 'px';
        }
    }

    function handleMouseUp(e) {
        if (!isDragging || !dragStartSq) return;
        
        isDragging = false;
        const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
        const squareEl = elementAtPoint ? elementAtPoint.closest('.square') : null;
        
        if (squareEl) {
            const r = parseInt(squareEl.dataset.row);
            const c = parseInt(squareEl.dataset.col);
            const moves = getLegalMoves(dragStartSq.r, dragStartSq.c);
            const move = moves.find(m => m.to.r === r && m.to.c === c);
            
            if (move) {
                if (move.promotion) {
                    awaitingPromotion = move;
                    showPromotionModal(currentPlayer);
                } else {
                    executeMove(move);
                }
            }
        }
        
        if (draggedPieceEl) {
            draggedPieceEl.classList.remove("dragging");
            draggedPieceEl.style.position = '';
            draggedPieceEl.style.zIndex = '';
            draggedPieceEl.style.pointerEvents = '';
        }
        
        draggedPieceEl = null;
        dragStartSq = null;
        renderBoard();
    }

    // --- LOGIKA KLIKNIĘĆ (Alternatywa dla D&D) ---
    function handleSquareClick(r, c) {
        if (gameOver || awaitingPromotion || isDragging) return;

        if (selectedSq) {
            const moves = getLegalMoves(selectedSq.r, selectedSq.c);
            const move = moves.find(m => m.to.r === r && m.to.c === c);

            if (move) {
                if (move.promotion) {
                    awaitingPromotion = move;
                    showPromotionModal(currentPlayer);
                    return;
                }
                executeMove(move);
                selectedSq = null;
            } else {
                const piece = board[r][c];
                if (piece && getColor(piece) === currentPlayer) {
                    selectedSq = { r, c };
                    clearHighlights();
                    highlightLegalMoves(r, c);
                } else {
                    selectedSq = null;
                    clearHighlights();
                }
            }
        } else {
            const piece = board[r][c];
            if (piece && getColor(piece) === currentPlayer) {
                selectedSq = { r, c };
                clearHighlights();
                highlightLegalMoves(r, c);
            }
        }
    }

    // --- SILNIK: GENEROWANIE RUCHÓW ---
    function getPseudoLegalMoves(r, c, currentBoard) {
        const piece = currentBoard[r][c];
        if (!piece) return [];
        
        const moves = [];
        const color = getColor(piece);
        const type = piece.toLowerCase();
        
        if (type === 'p') {
            const dir = color === 'white' ? -1 : 1;
            const startRow = color === 'white' ? 6 : 1;
            
            if (isOnBoard(r + dir, c) && !currentBoard[r + dir][c]) {
                addPawnMove(moves, r, c, r + dir, c, color);
                if (r === startRow && !currentBoard[r + 2 * dir][c]) {
                    moves.push({ from: {r, c}, to: {r: r + 2 * dir, c}, type: 'double' });
                }
            }
            for (let dc of [-1, 1]) {
                if (isOnBoard(r + dir, c + dc)) {
                    const target = currentBoard[r + dir][c + dc];
                    if (target && getColor(target) !== color) {
                        addPawnMove(moves, r, c, r + dir, c + dc, color);
                    } else if (enPassantTarget && enPassantTarget.r === r + dir && enPassantTarget.c === c + dc) {
                        moves.push({ from: {r, c}, to: {r: r + dir, c: c + dc}, type: 'enpassant' });
                    }
                }
            }
        } else if (type === 'n' || type === 'k') {
            const directions = type === 'n' ? DIRS.knight : DIRS.king;
            for (let [dr, dc] of directions) {
                const nr = r + dr, nc = c + dc;
                if (isOnBoard(nr, nc)) {
                    const target = currentBoard[nr][nc];
                    if (!target || getColor(target) !== color) {
                        moves.push({ from: {r, c}, to: {r: nr, c: nc}, type: 'normal' });
                    }
                }
            }
            if (type === 'k') {
                const rank = color === 'white' ? 7 : 0;
                if (r === rank && c === 4) {
                    if ((color === 'white' && castlingRights.wK) || (color === 'black' && castlingRights.bK)) {
                        if (!currentBoard[rank][5] && !currentBoard[rank][6]) moves.push({ from: {r, c}, to: {r: rank, c: 6}, type: 'castling' });
                    }
                    if ((color === 'white' && castlingRights.wQ) || (color === 'black' && castlingRights.bQ)) {
                        if (!currentBoard[rank][3] && !currentBoard[rank][2] && !currentBoard[rank][1]) moves.push({ from: {r, c}, to: {r: rank, c: 2}, type: 'castling' });
                    }
                }
            }
        } else {
            const directions = DIRS[type === 'b' ? 'bishop' : type === 'r' ? 'rook' : 'queen'];
            for (let [dr, dc] of directions) {
                let nr = r + dr, nc = c + dc;
                while (isOnBoard(nr, nc)) {
                    const target = currentBoard[nr][nc];
                    if (!target) {
                        moves.push({ from: {r, c}, to: {r: nr, c: nc}, type: 'normal' });
                    } else {
                        if (getColor(target) !== color) moves.push({ from: {r, c}, to: {r: nr, c: nc}, type: 'normal' });
                        break;
                    }
                    nr += dr; nc += dc;
                }
            }
        }
        return moves;
    }

    function addPawnMove(moves, r1, c1, r2, c2, color) {
        const promoRow = color === 'white' ? 0 : 7;
        if (r2 === promoRow) {
            ['q', 'r', 'b', 'n'].forEach(p => moves.push({ from: {r: r1, c: c1}, to: {r: r2, c: c2}, type: 'promotion', promotion: p }));
        } else {
            moves.push({ from: {r: r1, c: c1}, to: {r: r2, c: c2}, type: 'normal' });
        }
    }

    function getLegalMoves(r, c) {
        const pseudo = getPseudoLegalMoves(r, c, board);
        const color = getColor(board[r][c]);
        return pseudo.filter(m => {
            const sim = board.map(row => [...row]);
            sim[m.to.r][m.to.c] = sim[m.from.r][m.from.c];
            sim[m.from.r][m.from.c] = null;
            if (m.type === 'enpassant') sim[m.from.r][m.to.c] = null;
            
            if (m.type === 'castling') {
                if (isKingInCheck(color, board)) return false;
                const step = m.to.c === 6 ? 1 : -1;
                if (isSquareAttacked(m.from.r, m.from.c + step, color, board)) return false;
            }
            return !isKingInCheck(color, sim);
        });
    }

    function isKingInCheck(color, currentBoard) {
        let kr = -1, kc = -1;
        const char = color === 'white' ? 'K' : 'k';
        for(let r=0; r<8; r++) for(let c=0; c<8; c++) if(currentBoard[r][c] === char) { kr=r; kc=c; }
        return isSquareAttacked(kr, kc, color, currentBoard);
    }

    function isSquareAttacked(r, c, defColor, currentBoard) {
        const atkColor = defColor === 'white' ? 'black' : 'white';
        for(let i=0; i<8; i++) {
            for(let j=0; j<8; j++) {
                if(currentBoard[i][j] && getColor(currentBoard[i][j]) === atkColor) {
                    const moves = getPseudoLegalMoves(i, j, currentBoard);
                    if(moves.some(m => m.to.r === r && m.to.c === c)) return true;
                }
            }
        }
        return false;
    }

    // --- EXECUTION ---
    function executeMove(move) {
        const piece = board[move.from.r][move.from.c];
        const target = board[move.to.r][move.to.c];
        
        let pgn = generateMoveNotation(move, piece, target);
        
        board[move.to.r][move.to.c] = move.promotion ? (isWhite(piece) ? move.promotion.toUpperCase() : move.promotion) : piece;
        board[move.from.r][move.from.c] = null;

        if (move.type === 'enpassant') board[move.from.r][move.to.c] = null;
        if (move.type === 'castling') {
            const r = move.from.r;
            if (move.to.c === 6) { board[r][5] = board[r][7]; board[r][7] = null; }
            else { board[r][3] = board[r][0]; board[r][0] = null; }
        }

        // Rights
        if (piece === 'K') { castlingRights.wK = false; castlingRights.wQ = false; }
        if (piece === 'k') { castlingRights.bK = false; castlingRights.bQ = false; }
        if (piece === 'R' && move.from.r === 7 && move.from.c === 7) castlingRights.wK = false;
        if (piece === 'R' && move.from.r === 7 && move.from.c === 0) castlingRights.wQ = false;
        if (piece === 'r' && move.from.r === 0 && move.from.c === 7) castlingRights.bK = false;
        if (piece === 'r' && move.from.r === 0 && move.from.c === 0) castlingRights.bQ = false;

        enPassantTarget = move.type === 'double' ? { r: (move.from.r + move.to.r)/2, c: move.from.c } : null;
        currentPlayer = currentPlayer === "white" ? "black" : "white";

        const isCheck = isKingInCheck(currentPlayer, board);
        const movesLeft = hasAnyLegalMoves(currentPlayer);
        if (isCheck) pgn += movesLeft ? "+" : "#";
        
        logMovePGN(pgn);
        if (!movesLeft) {
            gameOver = true;
            showGameAlert(isCheck ? "SZACH MAT!" : "PAT!", "Koniec partii");
        }

        clearHighlights();
        savedArrows = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderBoard();
        updateUI();
        updateEvalBar();
    }

    function generateMoveNotation(move, piece, target) {
        if (move.type === 'castling') return move.to.c === 6 ? "O-O" : "O-O-O";
        let res = "";
        if (piece.toLowerCase() !== 'p') res += piece.toUpperCase();
        else if (target || move.type === 'enpassant') res += String.fromCharCode(97 + move.from.c);
        if (target || move.type === 'enpassant') res += "x";
        res += String.fromCharCode(97 + move.to.c) + (8 - move.to.r);
        if (move.promotion) res += "=" + move.promotion.toUpperCase();
        return res;
    }

    function hasAnyLegalMoves(color) {
        for(let r=0; r<8; r++) for(let c=0; c<8; c++) {
            if(board[r][c] && getColor(board[r][c]) === color) {
                if(getLegalMoves(r, c).length > 0) return true;
            }
        }
        return false;
    }

    // --- UI HELPERS ---
    function highlightLegalMoves(r, c) {
        getSquareElement(r, c).classList.add("highlight");
        getLegalMoves(r, c).forEach(m => getSquareElement(m.to.r, m.to.c).classList.add("hint"));
    }

    function clearHighlights() {
        document.querySelectorAll(".highlight, .hint").forEach(el => el.classList.remove("highlight", "hint"));
    }

    function renderHeatmap() {
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const sq = getSquareElement(r, c);
                const wAtk = isSquareAttacked(r, c, 'black', board);
                const bAtk = isSquareAttacked(r, c, 'white', board);
                const ally = currentPlayer === 'white' ? wAtk : bAtk;
                const enemy = currentPlayer === 'white' ? bAtk : wAtk;
                if (ally && enemy) sq.classList.add("ctrl-clash");
                else if (ally) sq.classList.add("ctrl-ally");
                else if (enemy) sq.classList.add("ctrl-enemy");
            }
        }
    }

    function logMovePGN(pgn) {
        if (currentPlayer === "black") {
            pgnMoves.push(`${fullMoveNumber}. ${pgn}`);
            if (historyList) {
                const div = document.createElement("div");
                div.className = "history-row";
                div.id = `h-${fullMoveNumber}`;
                div.innerHTML = `<span>${fullMoveNumber}.</span><b>${pgn}</b><i class="b-move">...</i>`;
                historyList.appendChild(div);
                historyList.scrollTop = historyList.scrollHeight;
            }
        } else {
            pgnMoves[pgnMoves.length-1] += ` ${pgn}`;
            const row = document.getElementById(`h-${fullMoveNumber}`);
            if (row) row.querySelector(".b-move").textContent = pgn;
            fullMoveNumber++;
        }
    }

    function showPromotionModal(color) {
        promoPieces.innerHTML = "";
        const opts = color === 'white' ? ['Q','R','B','N'] : ['q','r','b','n'];
        opts.forEach(p => {
            const d = document.createElement("div");
            d.textContent = ICONS[p];
            d.onclick = () => {
                awaitingPromotion.promotion = p;
                promoModal.style.display = "none";
                const m = awaitingPromotion;
                awaitingPromotion = null;
                executeMove(m);
            };
            promoPieces.appendChild(d);
        });
        promoModal.style.display = "block";
    }

    // --- CANVAS ARROWS ---
    boardEl.oncontextmenu = (e) => e.preventDefault();
    boardEl.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            isDrawingArrow = true;
            const rect = boardEl.getBoundingClientRect();
            arrowStartSq = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    });

    window.addEventListener('mousemove', (e) => {
        moveDraggedPiece(e);
        if (!isDrawingArrow) return;
        const rect = boardEl.getBoundingClientRect();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        savedArrows.forEach(a => drawArrow(a.x1, a.y1, a.x2, a.y2));
        drawArrow(arrowStartSq.x, arrowStartSq.y, e.clientX - rect.left, e.clientY - rect.top);
    });

    window.addEventListener('mouseup', (e) => {
        handleMouseUp(e);
        if (e.button === 2 && isDrawingArrow) {
            isDrawingArrow = false;
            const rect = boardEl.getBoundingClientRect();
            savedArrows.push({ x1: arrowStartSq.x, y1: arrowStartSq.y, x2: e.clientX - rect.left, y2: e.clientY - rect.top });
        }
    });

    function drawArrow(x1, y1, x2, y2) {
        const angle = Math.atan2(y2-y1, x2-x1);
        ctx.strokeStyle = "rgba(231, 76, 60, 0.8)";
        ctx.lineWidth = 6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 15 * Math.cos(angle - Math.PI/6), y2 - 15 * Math.sin(angle - Math.PI/6));
        ctx.lineTo(x2 - 15 * Math.cos(angle + Math.PI/6), y2 - 15 * Math.sin(angle + Math.PI/6));
        ctx.fillStyle = "rgba(231, 76, 60, 0.8)"; ctx.fill();
    }

    // --- UTILS ---
    function isOnBoard(r, c) { return r>=0 && r<8 && c>=0 && c<8; }
    function isWhite(p) { return p === p.toUpperCase(); }
    function getColor(p) { return isWhite(p) ? 'white' : 'black'; }
    function getSquareElement(r, c) { return document.querySelector(`.square[data-row='${r}'][data-col='${c}']`); }
    function updateUI() { if(turnInfo) turnInfo.textContent = `TURA: ${currentPlayer.toUpperCase()}`; }
    function resizeCanvas() { const r = boardEl.getBoundingClientRect(); canvas.width = r.width; canvas.height = r.height; }
    function showGameAlert(t, b) { 
        document.getElementById("alert-title").textContent = t; 
        document.getElementById("alert-body").textContent = b; 
        gameAlert.style.display = "block"; 
    }
    function updateEvalBar() {
        if (!evalWhite) return;
        const score = board.flat().reduce((acc, p) => {
            if(!p) return acc;
            const v = {p:1, n:3, b:3, r:5, q:9, k:0}[p.toLowerCase()];
            return isWhite(p) ? acc + v : acc - v;
        }, 0);
        const percent = 50 + (score * 2);
        evalWhite.style.height = `${Math.min(Math.max(percent, 5), 95)}%`;
    }

    // --- BUTTONS ---
    document.getElementById("resetBtn").onclick = initGame;
    document.getElementById("analysisBtn").onclick = () => { isHeatmapActive = !isHeatmapActive; renderBoard(); };
    document.getElementById("flipBtn").onclick = () => { boardEl.classList.toggle("flipped"); ctx.clearRect(0, 0, canvas.width, canvas.height); savedArrows = []; };
    document.getElementById("pgnBtn").onclick = () => {
        const text = `[Event "Chess Arena"]\n[Result "*"]\n\n${pgnMoves.join(" ")}`;
        const blob = new Blob([text], {type: "text/plain"});
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "game.pgn"; a.click();
    };
    document.getElementById("hintBtn").onclick = () => {
        const all = [];
        for(let r=0; r<8; r++) for(let c=0; c<8; c++) if(board[r][c] && getColor(board[r][c])===currentPlayer) getLegalMoves(r,c).forEach(m => all.push(m));
        if(all.length) {
            const m = all[Math.floor(Math.random()*all.length)];
            clearHighlights();
            getSquareElement(m.from.r, m.from.c).classList.add("hint");
            getSquareElement(m.to.r, m.to.c).classList.add("hint");
        }
    };

    window.addEventListener('resize', resizeCanvas);
    initGame();
})();