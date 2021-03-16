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

  canchasTable: Cancha[] = [];
  canchas: Cancha[] = [];

  page = 1;
  pageSize = 8;
  collectionSize = 0;

  constructor(private canchaService: CanchaService,
              private router: Router,
              private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.canchaService.consultar()
      .subscribe(
        (response) => {
          this.canchas = response;
          this.collectionSize = this.canchas.length;
          this.refresTable();
        });
  }


  refresTable() {
    this.canchasTable = this.canchas
      .slice((this.page - 1) * this.pageSize, (this.page - 1) * this.pageSize + this.pageSize);
  }

  crearCancha() {
    this.router.navigate([ 'crear-cancha' ], { relativeTo: this.route });
  }

  actualizarCancha(canchaSeleccionada: Cancha) {
    localStorage.setItem('canchaSeleccionada', JSON.stringify(canchaSeleccionada));
    this.router.navigate([ 'actualizar-cancha' ], { relativeTo: this.route });
  }


}
