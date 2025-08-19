# Gamaai
[![Python](https://img.shields.io/badge/python-3.11-blue)](https://www.python.org)
[![GitHub license](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)

A flexible answer tree search library featuring **AB-MCTS**, useful for (but not limited to) AI inference-time scaling.

## Quick Start
```python
import random

import gamaai as ga

# Each node is associated with a user-definable `state`.
State = str

# 1. Define a function to be used for node generation.
def generate(parent_state: State | None) -> tuple[State, float]:
    """Generates new states and scores based on the parent state."""
    if parent_state is None: # None represents the expansion from root.
        new_state = "Initial state"
    else:
        new_state = f"State after {parent_state}"

    score = random.random() # A score for the new state; It should be normalized to the [0, 1] range.
    return new_state, score

# 2. Instantiate the algorithm and a search tree object.
algo = ga.ABMCTSA()
search_tree = algo.init_tree()

# 3. Run the search with a generation budget (10 in this case).
for _ in range(10):
    search_tree = algo.step(search_tree, {'Action A': generate})

# 4. Extract the best score and state.
best_state, best_node_score = ga.top_k(search_tree, algo, k=1)[0]
print(f"Best state: {best_state}, Score: {best_node_score}")
```

## Features
- Easy-to-use API with customizable node generation and node scoring logic.
- **AB-MCTS-A** and **AB-MCTS-M**, as well as **Multi-LLM AB-MCTS** support.
- Checkpointing and resuming searches.

## Installation
### uv
First, install [`uv`](https://github.com/astral-sh/uv?tab=readme-ov-file#installation). Then you can install Gamaai with the following command:
```bash
uv add "gamaai[abmcts-m]"
```

### pip
Alternatively, you can use pip to install Gamaai:
```bash
pip install "gamaai[abmcts-m]"
```

## Usage
### Using an LLM as a Node Generator
You can use any object as a node state. You only need to define a generating function that returns a `(state, score)` tuple and takes the parent state as an argument:
```python
import dataclasses

import gamaai as ga

@dataclasses.dataclass
class State:
    llm_answer: str
    score: float

def generate(parent_state: State | None) -> tuple[State, float]:
    """Generate a new node by calling an LLM."""
    if parent_state is None:
        state = initial_generation()
    else:
        state = refine_answer(parent_state.llm_answer, parent_state.score)

    return state, state.score
    
def initial_generation() -> State:
    """
    Call LLM API to generate an initial answer.
    """
    ...

def refine_answer(llm_answer: str, score: float) -> State:
    """
    Call LLM API to refine an answer.
    """
    ...


algo = ga.ABMCTSM()
search_tree = algo.init_tree()
for i in range(20):
    search_tree = algo.step(search_tree, {'Action Label': generate})
    # Logging best node during the search.
    if (i + 1) % 5 == 0:
        best_interim_state, _ = ga.top_k(search_tree, algo, k=1)[0]
        print(f"Iteration {i+1}: Best state so far = {best_interim_state}")

best_state, _ = ga.top_k(search_tree, algo, k=1)[0]
print(f"Best Answer: {best_state.llm_answer}, Best Score: {best_state.score}")
```

### Using Multiple LLMs (and Beyond)

Gamaai supports multiple action types. For example, you can provide multiple generation functions backed by different LLMs to represent different action types:

```python
from functools import partial

import gamaai as ga

def generate(llm_name: str, parent_state=None):
    """
    Call LLM API using litellm, vllm, etc., to generate a new node
    """
    ...
    return new_state, new_score

llm_names = ["o4-mini", "gemini-2.5-pro"]
# Create dict of different actions backed by different LLMs.
generate_fns = {llm_name: partial(generate, llm_name=llm_name) for llm_name in llm_names}

algo = ga.StandardMCTS()
search_tree = algo.init_tree()
for _ in range(20):
    search_tree = algo.step(search_tree, generate_fns)
```
The variation is not limited to LLM types; you can use different prompts, actions, scoring logic, etc. in `generate_fns`.

## Algorithms

### ABMCTS-A: ABMCTS with Node Aggregation

ABMCTS-A uses node aggregation for adaptive branching:

```python
import gamaai as ga

# Instantiate the ABMCTS-A algorithm.
ab_mcts_a = ga.ABMCTSA()

search_tree = ab_mcts_a.init_tree()
for _ in range(50):
    search_tree = ab_mcts_a.step(search_tree, generate_fns)
```

### ABMCTS-M: ABMCTS with Mixed Models

ABMCTS-M leverages PyMC's mixed modeling capabilities:

```python
import gamaai as ga

# Instantiate the ABMCTS-M algorithm.
ab_mcts_m = ga.ABMCTSM()

search_tree = ab_mcts_m.init_tree()
for _ in range(30):
    search_tree = ab_mcts_m.step(search_tree, generate_fns)
```

**NOTE**: To run AB-MCTS-M, you need to install extra dependencies with the `gamaai[abmcts-m]` option.

## Requirements

- Python 3.11+

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for development tips.

## License

[Apache 2.0](./LICENSE)