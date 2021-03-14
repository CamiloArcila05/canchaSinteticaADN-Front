import {Component, OnInit} from '@angular/core';
import {CanchaService} from '../../shared/service/cancha.service';
import {Cancha} from '../../shared/model/cancha';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
  selector: 'app-listar-cancha',
  templateUrl: './listar-cancha.component.html',
  styleUrls: ['./listar-cancha.component.scss']
})
export class ListarCanchaComponent implements OnInit {

  displayedColumns: string[] = ['id', 'nombre', 'descripcion', 'valorDia', 'valorNoche', 'estado', 'acciones'];
  data;

  canchas: Cancha[] = [];

  constructor(private canchaService: CanchaService,
              private router: Router,
              private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.canchaService.consultar()
      .subscribe(
        (response) => {
          this.canchas = response;
        });
  }


  crearCancha() {
    this.router.navigate([ 'crear-cancha' ], { relativeTo: this.route });
  }

  actualizarCancha(canchaSeleccionada: Cancha) {
    localStorage.setItem('canchaSeleccionada', JSON.stringify(canchaSeleccionada));
    this.router.navigate([ 'actualizar-cancha' ], { relativeTo: this.route });
  }


}
