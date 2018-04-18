from .notebook import draw, generate, to_json

__title__ = "igraph"
__version__ = "0.1.11"
__author__ = "Patrick Fuller"
__license__ = "MIT"

raise DeprecationWarning("To avoid name collision with the igraph project, "
                         "this visualization library has been renamed to "
                         "'jgraph'. Please upgrade when convenient.")
