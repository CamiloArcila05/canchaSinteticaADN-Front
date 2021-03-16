import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Reserva} from '../../shared/model/reserva';
import {ReservaService} from '../../shared/service/reserva.service';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {CancelarReservaComponent} from '../cancelar-reserva/cancelar-reserva.component';
import {FinalizarReservaComponent} from '../finalizar-reserva/finalizar-reserva.component';

@Component({
  selector: 'app-listar-reserva',
  templateUrl: './listar-reserva.component.html',
  styleUrls: ['./listar-reserva.component.scss']
})
export class ListarReservaComponent implements OnInit {

  displayedColumns: string[] = ['id', 'canchaId', 'nombreSolicita', 'fecha', 'hora', 'estado', 'valorAbono', 'valorTotal'];
  data;
  closeResult = '';

  reservasTabe: Reserva[] = [];
  reservas: Reserva[] = [];

  page = 1;
  pageSize = 8;
  collectionSize = 0;

  constructor(private reservaService: ReservaService,
              private router: Router,
              private modalService: NgbModal,
              private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.reservaService.consultar()
      .subscribe(
        (response) => {
          this.reservas = response;
          this.collectionSize = this.reservas.length;
          this.refresTable();
        });
  }

  refresTable() {
    this.reservasTabe = this.reservas
      .slice((this.page - 1) * this.pageSize, (this.page - 1) * this.pageSize + this.pageSize);
  }
  crearReserva() {
    this.router.navigate(['crear-reserva'], {relativeTo: this.route});
  }
  cancelarReserva(reservaSeleccionada: Reserva) {
    console.log(JSON.stringify(reservaSeleccionada));
    localStorage.setItem('reservaSeleccionada', JSON.stringify(reservaSeleccionada));
    this.modalService.open(CancelarReservaComponent)
      .result
      .then(() => {
      }, (reason) => {
        console.log(reason);
        if (reason === 'exito') {
          this.ngOnInit();
        }
      });
  }

  finalizarReserva(reservaSeleccionada: Reserva) {
    localStorage.setItem('reservaSeleccionada', JSON.stringify(reservaSeleccionada));
    this.modalService.open(FinalizarReservaComponent)
      .result
      .then(() => {
      }, (reason) => {
        console.log(reason);
        if (reason === 'exito') {
          this.ngOnInit();
        }
      });
  }

}
