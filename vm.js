const instructionSet = {
  HALT: 0,    //  Stop machine execution
  PUSH: 1,    //  Push the next program word onto the stack
  POP:  2,    //  Pop the top of the stack
  DUP:  3,    //  Duplicate the top of the stack
  ADD:  4,    //  [SP] +  [SP+1]
  SUB:  5,    //  [SP] -  [SP+1]
  MUL:  6,    //  [SP] *  [SP+1]
  DIV:  7,    //  [SP] /  [SP+1]
  NOT:  8,    // ~[SP]
  AND:  9,    //  [SP] && [SP+1]
  OR:   10,   //  [SP] || [SP+1]
  EQ:   11,   //  [SP] == [SP+1]
  GT:   12,   //  [SP] <  [SP+1]
  GTE:  13,   //  [SP] <= [SP+1]
  JMP:  14,   //  Jump to instruction in held next program word
  JIF:  15    //  If [SP] != 0, jump to instruction held in next program word
};

// Very basic assembler
function mnemonic(x) {
  const tokens = x.match(/\S+/g);
  const fns = {
    PUSH: () => [instructionSet.PUSH, parseInt(tokens[1])],
    JMP:  () => [instructionSet.JMP, parseInt(tokens[1])],
    JIF:  () => [instructionSet.JIF, parseInt(tokens[1])],
  };

  const fn = fns[tokens[0]] !== undefined ? fns[tokens[0]] : () => [instructionSet[x]];
  return fn();
}

function assemble(asm) {
  return asm.reduce((program, instruction) => [...program, ...mnemonic(instruction)], []);
}

// Function to create a VM that will run the input program
function makeCPU(program) {
  const validateProgram = () => program.length > 0;

    // Todo: We could add a size constraint
  const makeStack = () => {
    const memory = [];
    return {
      pointer:  ()  => memory.length,
      memory:   ()  => memory,
      push:     x   => memory.unshift(x),
      pop:      ()  => memory.shift(),
    };
  };

  const badCPU = {
    run: () => undefined,
    step: () => undefined,
    getInstructionAddress: () => 0,
    isHalted: () => true,
    getStack: () => [],
    getStackPointer: () => 0,
  };

  const goodCPU = () => {
    // Processor state
    let isHalted = false;
    let instructionAddress = 0;
    let fault = undefined;
    const stack = makeStack();

    // Processor fault
    const raiseFault = x => {
      fault = x;
      isHalted = true;
    };

    // Instruction fetch
    const getNextProgramWord = () => program[instructionAddress++];

    // Processor binary operation "ALU"
    const binaryOp = (op, pred=()=>true) => {
      const validateOperands = (x, y) => x !== undefined && y !== undefined;
      const operand1 = stack.pop();
      const operand0 = stack.pop();
      const doBinOp = () => stack.push(op(operand0, operand1));
      const fn = validateOperands(operand0, operand1) && pred(operand0, operand1) ? doBinOp : raiseFault.bind(this, 'BIN_OP');
      fn();
    };

    // Processor unary operation "ALU"
    const unaryOp = (op, pred=()=>true) => {
      const validateOperand = x => x !== undefined;
      const operand0 = stack.pop();
      const doUniOp = () => stack.push(op(operand0));
      const fn = validateOperand(operand0) && pred(operand0) ? doUniOp : raiseFault.bind(this, 'UNI_OP');
      fn();
    };

    const stackOp = (op, minStackSize=0) => {
      const fn = minStackSize <= stack.pointer() ? op : raiseFault.bind(this, 'STACK_OP');
      fn();
    };

    // Instructions
    // Processor
    const instructionHaltCpu  = () => isHalted = true;

    // Stack
    const instructionPush     = () => stackOp(stack.push.bind(this, getNextProgramWord()));
    const instructionPop      = () => stackOp(stack.pop, 1);
    const instructionDup      = () => stackOp(stack.push.bind(this, stack.memory()[0]), 1);

    // Arithmetic
    const instructionAdd      = () => binaryOp((x, y) => x + y);
    const instructionSub      = () => binaryOp((x, y) => x - y);
    const instructionMul      = () => binaryOp((x, y) => x * y);
    const instructionDiv      = () => binaryOp((x, y) => x / y, (x, y) => y != 0);

    // Boolean
    const instructionNot      = () => unaryOp(x => !x ? 1 : 0);
    const instructionAnd      = () => binaryOp((x, y) => x && y ? 1 : 0);
    const instructionOr       = () => binaryOp((x, y) => x || y ? 1 : 0);

    // Conditional
    const instructionEq       = () => binaryOp((x, y) => x == y ? 1 : 0);
    const instructionGt       = () => binaryOp((x, y) => x >  y ? 1 : 0);
    const instructionGte      = () => binaryOp((x, y) => x >= y ? 1 : 0);

    // Flow control
    const instructionJmp      = () => instructionAddress = getNextProgramWord();
    const instructionJif      = () => stackOp(() => stack.pop() != 0 ? instructionAddress = getNextProgramWord() : getNextProgramWord(), 1);

    // Instruction Decoder
    const instructionDecoder = {
      [instructionSet['HALT']]: instructionHaltCpu,
      [instructionSet['PUSH']]: instructionPush,
      [instructionSet['POP']]:  instructionPop,
      [instructionSet['DUP']]:  instructionDup,
      [instructionSet['ADD']]:  instructionAdd,
      [instructionSet['SUB']]:  instructionSub,
      [instructionSet['MUL']]:  instructionMul,
      [instructionSet['DIV']]:  instructionDiv,
      [instructionSet['NOT']]:  instructionNot,
      [instructionSet['AND']]:  instructionAnd,
      [instructionSet['OR']]:   instructionOr,
      [instructionSet['EQ']]:   instructionEq,
      [instructionSet['GT']]:   instructionGt,
      [instructionSet['GTE']]:  instructionGte,
      [instructionSet['JMP']]:  instructionJmp,
      [instructionSet['JIF']]:  instructionJif,
    };

    const step = () => {
      const fn = !isHalted ? () => instructionDecoder[getNextProgramWord()]() : () => {};
      fn();
    };

    const run = () => {
      while (!isHalted) {
        step();
      }
    };

    return {
      run: run,
      step: step,
      getInstructionAddress: () => instructionAddress,
      isHalted: () => isHalted,
      getStack: () => stack.memory(),
      getStackPointer: () => stack.pointer(),
      getProcessorFault: () => fault,
    };
  };

  return validateProgram() ? goodCPU() : badCPU;
}

// Test runner
function runTests() {
  const tests = [
    testEmptyProgramDoesNothing,
    testPushPushAndThenHalt,
    testAddTwoNumbers,
    testReduceAdd,
    testSubTwoNumbers,
    testMulTwoNumbers,
    testDivTwoNumbers,
    testArithmetic,
    testDivByZeroRaisesFault,
    testUnaryNotTrue,
    testUnaryNotFalse,
    testUnaryNeedsOneItemOnTheStack,
    testAndTrueTrue,
    testOrTrueFalse,
    testPop,
    testPopNeedsAnItemOnTheStack,
    testDup,
    testDupNeedsAnItemOnTheStack,
    testIsEqOneWhenEq,
    testIsEqZeroWhenNotEq,
    testIsGtOneWhenGt,
    testIsGtZeroWhenNotGt,
    testIsGteOneWhenEq,
    testIsGteOneWhenGt,
    testIsGteZeroWhenLt,
    testUnconditionalJump,
    testConditionalJump
  ];

  tests.map(x => x());
}

// Test functions
function testEmptyProgramDoesNothing() {
  const program = assemble(['HALT']);
  
  const cpu = makeCPU(program);
  cpu.step();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackIsEmpty(cpu);
}

function testPushPushAndThenHalt() {
  const program = assemble(['PUSH 42', 'PUSH 68', 'HALT']);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [68, 42]);
}

function testAddTwoNumbers() {
  const program = assemble(['PUSH 123', 'PUSH 12', 'ADD', 'HALT']);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [123 + 12]);
}

function testReduceAdd() {
  const program = assemble([
  // [4]       [3]       [2]       [1]       [0]       Init      
    'PUSH 5', 'PUSH 4', 'PUSH 3', 'PUSH 2', 'PUSH 1', 'PUSH 0', 'ADD', 'ADD', 'ADD', 'ADD', 'ADD', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [[1, 2, 3, 4, 5].reduce((a, x) => a + x, 0)]);
}

function testSubTwoNumbers() {
  const program = assemble(['PUSH 123', 'PUSH 12', 'SUB', 'HALT']);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [123 - 12]);
}

function testMulTwoNumbers() {
  const program = assemble(['PUSH 123', 'PUSH 12', 'MUL', 'HALT']);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [123 * 12]);
}

function testDivTwoNumbers() {
  const program = assemble(['PUSH 100', 'PUSH 5', 'DIV', 'HALT']);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [100 / 5]);
}

function testDivByZeroRaisesFault() {
  const program = assemble(['PUSH 100', 'PUSH 0', 'DIV', 'HALT']);

  const cpu = makeCPU(program);
  cpu.run();

  assertCpuHalted(cpu);
  assertCpuFault(cpu);
  assertStackContains(cpu, [100 / 5]);
}

function testArithmetic() {
  // (1 + 2 * 3) / 7 - 5
  const program = assemble([
    'PUSH 1', 'PUSH 2', 'PUSH 3', 'MUL', 'ADD', 'PUSH 7', 'DIV', 'PUSH 5', 'SUB', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [(1 + 2 * 3) / 7 - 5]);
}

function testUnaryNotTrue() {
  const program = assemble([
    'PUSH 1', 'NOT', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [0]);
}

function testUnaryNotFalse() {
  const program = assemble([
    'PUSH 0', 'NOT', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [1]);
}

function testUnaryNeedsOneItemOnTheStack() {
  const program = assemble([
    'NOT', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertCpuHalted(cpu);
  assertCpuFault(cpu);
}

function testAndTrueTrue() {
  const program = assemble([
    'PUSH 1', 'PUSH 1', 'AND', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [1]);
};

function testOrTrueFalse() {
  const program = assemble([
    'PUSH 1', 'PUSH 0', 'OR', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [1]);
};

function testPop() {
  const program = assemble([
    'PUSH 1', 'POP', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackIsEmpty(cpu);
};

function testPopNeedsAnItemOnTheStack() {
  const program = assemble([
    'POP', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertCpuHalted(cpu);
  assertCpuFault(cpu);
};

function testDup() {
  const program = assemble([
    'PUSH 1', 'DUP', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [1, 1]);
};

function testDupNeedsAnItemOnTheStack() {
  const program = assemble([
    'DUP', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertCpuHalted(cpu);
  assertCpuFault(cpu);
};

function testIsEqOneWhenEq() {
  const program = assemble([
    'PUSH 5', 'DUP', 'EQ', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [1]);
}

function testIsEqZeroWhenNotEq() {
  const program = assemble([
    'PUSH 5', 'PUSH 6', 'EQ', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [0]);
}

function testIsGtOneWhenGt() {
  const program = assemble([
    'PUSH 6', 'PUSH 5', 'GT', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [1]);
}

function testIsGtZeroWhenNotGt() {
  const program = assemble([
    'PUSH 5', 'PUSH 6', 'GT', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [0]);
}

function testIsGteOneWhenEq() {
  const program = assemble([
    'PUSH 6', 'DUP', 'GTE', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [1]);
}

function testIsGteOneWhenGt() {
  const program = assemble([
    'PUSH 6', 'PUSH 5', 'GTE', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [1]);
}

function testIsGteZeroWhenLt() {
  const program = assemble([
    'PUSH 5', 'PUSH 6', 'GTE', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertStackContains(cpu, [0]);
}

function testUnconditionalJump() {
  const program = assemble([
  // 0     1   2       3     4
    'JMP 3', 'HALT', 'JMP 2'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, 3);
  assertCpuHalted(cpu);
};

function testConditionalJump() {
  const program = assemble([
  // 0      1   2     3     4    5      6   7     8   9
    'PUSH 1', 'JIF 5', 'POP', 'PUSH 0', 'JIF 4', 'HALT'
  ]);

  const cpu = makeCPU(program);
  cpu.run();

  assertInstructionAddress(cpu, program.length);
  assertCpuHalted(cpu);
  assertNoCpuFault(cpu);
};

// Assert functions
function assertEquals(x, y, errMsg) {
  console.assert(x == y, errMsg);
}

function assertTrue(x, errMsg) {
  assertEquals(x, true, errMsg);
}

function assertCpuHalted(cpu) {
  assertTrue(cpu.isHalted(), "CPU not halted.");
}

function assertCpuFault(cpu) {
  assertTrue(cpu.getProcessorFault() !== undefined, "No processor fault.")
}

function assertNoCpuFault(cpu) {
  assertTrue(cpu.getProcessorFault() === undefined, "Processor fault.")
}

function assertInstructionAddress(cpu, x) {
  assertEquals(x, cpu.getInstructionAddress(), "Instruction address incorrect.");
}

function assertStackIsEmpty(cpu) {
  assertEquals(cpu.getStackPointer(), 0, "Stack not empty.");
}

function arrayEq(x, y) {
  return x.reduce((a, e, i) => a && y[i] == e, true);
}

function assertStackContains(cpu, x) {
  assertTrue(arrayEq(cpu.getStack(), x), "Stack not equal.");
}

runTests();
