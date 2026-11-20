import { Component } from "react";
import { Alert, Button } from "./ui.jsx";
export default class SectionBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="card">
        <Alert>
          No pudimos abrir esta sección. Las otras páginas siguen disponibles.
        </Alert>
        <Button
          kind="secondary"
          onClick={() => this.setState({ failed: false })}
        >
          Volver a intentar
        </Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
