"""
Define the NLRunOnce class.

This is a simple nonlinear solver that just runs the system once.
"""

from six.moves import range

from openmdao.solvers.solver import NonlinearSolver


class NLRunOnce(NonlinearSolver):
    """
    Simple solver that runs the containing system once.

    This is done without iteration or norm calculation.
    """

    SOLVER = 'NL: RUNONCE'

    def solve(self):
        """
        Run the solver.

        Returns
        -------
        boolean
            Failure flag; True if failed to converge, False is successful.
        float
            absolute error.
        float
            relative error.
        """
        system = self._system
        for isub, subsys in enumerate(system._subsystems_allprocs):
            print("subsystem:", subsys.pathname)
            system._transfers['fwd', isub](system._inputs,
                                           system._outputs, 'fwd')

            if subsys in system._subsystems_myproc:
                subsys._solve_nonlinear()

        return False, 0.0, 0.0
